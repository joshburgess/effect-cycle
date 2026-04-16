import { HttpApiBuilder, HttpApiError } from "@effect/platform"
/**
 * Handler implementations for all 19 RealWorld API endpoints.
 *
 * Each group is implemented as a Layer via HttpApiBuilder.group().
 * All state mutations go through the in-memory Store service.
 */
import { Effect, Option, Ref } from "effect"
import { RealWorldApi } from "./Api.js"
import { CurrentUser } from "./Auth.js"
import type {
  ArticleBody,
  Author,
  CommentBody,
  Profile,
  StoredArticle,
  StoredUser,
} from "./Domain.js"
import { createToken } from "./Jwt.js"
import * as Password from "./Password.js"
import { Store, favoriteKey, followKey, slugify } from "./Store.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toProfile = (
  user: StoredUser,
  followsSet: ReadonlySet<string>,
  currentUserId: number | undefined,
): Profile => ({
  username: user.username,
  bio: user.bio,
  image: user.image,
  following:
    currentUserId !== undefined ? followsSet.has(followKey(currentUserId, user.id)) : false,
})

const toAuthor = (
  user: StoredUser,
  followsSet: ReadonlySet<string>,
  currentUserId: number | undefined,
): Author => ({
  username: user.username,
  bio: user.bio,
  image: user.image,
  following:
    currentUserId !== undefined ? followsSet.has(followKey(currentUserId, user.id)) : false,
})

const toArticleBody = (
  article: StoredArticle,
  author: StoredUser,
  followsSet: ReadonlySet<string>,
  favoritesSet: ReadonlySet<string>,
  currentUserId: number | undefined,
): ArticleBody => ({
  slug: article.slug,
  title: article.title,
  description: article.description,
  body: article.body,
  tagList: article.tagList as Array<string>,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
  favorited:
    currentUserId !== undefined ? favoritesSet.has(favoriteKey(currentUserId, article.id)) : false,
  favoritesCount: [...favoritesSet].filter((k) => k.endsWith(`:${article.id}`)).length,
  author: toAuthor(author, followsSet, currentUserId),
})

const toCommentBody = (
  comment: {
    readonly id: number
    readonly body: string
    readonly createdAt: string
    readonly updatedAt: string
  },
  author: StoredUser,
  followsSet: ReadonlySet<string>,
  currentUserId: number | undefined,
): CommentBody => ({
  id: comment.id,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  body: comment.body,
  author: toAuthor(author, followsSet, currentUserId),
})

/**
 * Try to read the current user from context. Returns undefined if not
 * authenticated (for endpoints with optional auth).
 */
const tryCurrentUser = Effect.serviceOption(CurrentUser).pipe(Effect.map(Option.getOrUndefined))

// ---------------------------------------------------------------------------
// Users group
// ---------------------------------------------------------------------------

export const UsersGroupLive = HttpApiBuilder.group(RealWorldApi, "users", (handlers) =>
  handlers
    .handle("login", ({ payload }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const users = yield* Ref.get(store.users)
        const user = users.find((u) => u.email === payload.user.email)
        if (!user) return yield* Effect.fail(new HttpApiError.Unauthorized())
        const valid = yield* Password.verify(payload.user.password, user.passwordHash)
        if (!valid) return yield* Effect.fail(new HttpApiError.Unauthorized())
        const token = yield* createToken(user.id, user.username)
        return {
          user: {
            email: user.email,
            token,
            username: user.username,
            bio: user.bio,
            image: user.image,
          },
        }
      }),
    )
    .handle("register", ({ payload }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const users = yield* Ref.get(store.users)
        const exists = users.some(
          (u) => u.email === payload.user.email || u.username === payload.user.username,
        )
        if (exists) return yield* Effect.fail(new HttpApiError.Conflict())
        const id = yield* Ref.getAndUpdate(store.nextUserId, (n) => n + 1)
        const passwordHash = yield* Password.hash(payload.user.password)
        const newUser = {
          id,
          email: payload.user.email,
          username: payload.user.username,
          passwordHash,
          bio: null,
          image: null,
        }
        yield* Ref.update(store.users, (items) => [...items, newUser])
        const token = yield* createToken(id, newUser.username)
        return {
          user: {
            email: newUser.email,
            token,
            username: newUser.username,
            bio: newUser.bio,
            image: newUser.image,
          },
        }
      }),
    )
    .handle("getCurrentUser", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const token = yield* createToken(user.id, user.username)
        return {
          user: {
            email: user.email,
            token,
            username: user.username,
            bio: user.bio,
            image: user.image,
          },
        }
      }),
    )
    .handle("updateUser", ({ payload }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        let updated = currentUser
        if (payload.user.email !== undefined) updated = { ...updated, email: payload.user.email }
        if (payload.user.username !== undefined)
          updated = { ...updated, username: payload.user.username }
        if (payload.user.bio !== undefined) updated = { ...updated, bio: payload.user.bio }
        if (payload.user.image !== undefined) updated = { ...updated, image: payload.user.image }
        if (payload.user.password !== undefined) {
          const hash = yield* Password.hash(payload.user.password)
          updated = { ...updated, passwordHash: hash }
        }
        yield* Ref.update(store.users, (items) =>
          items.map((u) => (u.id === currentUser.id ? updated : u)),
        )
        const token = yield* createToken(updated.id, updated.username)
        return {
          user: {
            email: updated.email,
            token,
            username: updated.username,
            bio: updated.bio,
            image: updated.image,
          },
        }
      }),
    ),
)

// ---------------------------------------------------------------------------
// Profiles group
// ---------------------------------------------------------------------------

export const ProfilesGroupLive = HttpApiBuilder.group(RealWorldApi, "profiles", (handlers) =>
  handlers
    .handle("getProfile", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const users = yield* Ref.get(store.users)
        const user = users.find((u) => u.username === path.username)
        if (!user) return yield* Effect.fail(new HttpApiError.NotFound())
        const follows = yield* Ref.get(store.follows)
        const me = yield* tryCurrentUser
        return { profile: toProfile(user, follows, me?.id) }
      }),
    )
    .handle("followUser", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const users = yield* Ref.get(store.users)
        const target = users.find((u) => u.username === path.username)
        if (!target) return yield* Effect.fail(new HttpApiError.NotFound())
        yield* Ref.update(
          store.follows,
          (s) => new Set([...s, followKey(currentUser.id, target.id)]),
        )
        const follows = yield* Ref.get(store.follows)
        return { profile: toProfile(target, follows, currentUser.id) }
      }),
    )
    .handle("unfollowUser", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const users = yield* Ref.get(store.users)
        const target = users.find((u) => u.username === path.username)
        if (!target) return yield* Effect.fail(new HttpApiError.NotFound())
        const key = followKey(currentUser.id, target.id)
        yield* Ref.update(store.follows, (s) => {
          const next = new Set(s)
          next.delete(key)
          return next
        })
        const follows = yield* Ref.get(store.follows)
        return { profile: toProfile(target, follows, currentUser.id) }
      }),
    ),
)

// ---------------------------------------------------------------------------
// Articles group
// ---------------------------------------------------------------------------

export const ArticlesGroupLive = HttpApiBuilder.group(RealWorldApi, "articles", (handlers) =>
  handlers
    .handle("listArticles", ({ urlParams }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const me = yield* tryCurrentUser
        let articles = yield* Ref.get(store.articles)
        const users = yield* Ref.get(store.users)
        const follows = yield* Ref.get(store.follows)
        const favs = yield* Ref.get(store.favorites)

        if (urlParams.tag !== undefined) {
          articles = articles.filter((a) => a.tagList.includes(urlParams.tag!))
        }
        if (urlParams.author !== undefined) {
          const authorUser = users.find((u) => u.username === urlParams.author)
          articles = authorUser ? articles.filter((a) => a.authorId === authorUser.id) : []
        }
        if (urlParams.favorited !== undefined) {
          const favUser = users.find((u) => u.username === urlParams.favorited)
          if (favUser) {
            articles = articles.filter((a) => favs.has(favoriteKey(favUser.id, a.id)))
          } else {
            articles = []
          }
        }

        const limit = urlParams.limit !== undefined ? Number.parseInt(urlParams.limit, 10) : 20
        const offset = urlParams.offset !== undefined ? Number.parseInt(urlParams.offset, 10) : 0
        const total = articles.length
        articles = articles.slice(offset, offset + limit)

        const bodies = articles.map((a) => {
          const author = users.find((u) => u.id === a.authorId)!
          return toArticleBody(a, author, follows, favs, me?.id)
        })

        return { articles: bodies, articlesCount: total }
      }),
    )
    .handle("feedArticles", ({ urlParams }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const articles = yield* Ref.get(store.articles)
        const users = yield* Ref.get(store.users)
        const follows = yield* Ref.get(store.follows)
        const favs = yield* Ref.get(store.favorites)

        // Feed shows articles from users you follow
        const followed = articles.filter((a) => follows.has(followKey(currentUser.id, a.authorId)))

        const limit = urlParams.limit !== undefined ? Number.parseInt(urlParams.limit, 10) : 20
        const offset = urlParams.offset !== undefined ? Number.parseInt(urlParams.offset, 10) : 0
        const total = followed.length
        const sliced = followed.slice(offset, offset + limit)

        const bodies = sliced.map((a) => {
          const author = users.find((u) => u.id === a.authorId)!
          return toArticleBody(a, author, follows, favs, currentUser.id)
        })

        return { articles: bodies, articlesCount: total }
      }),
    )
    .handle("getArticle", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const me = yield* tryCurrentUser
        const articles = yield* Ref.get(store.articles)
        const article = articles.find((a) => a.slug === path.slug)
        if (!article) return yield* Effect.fail(new HttpApiError.NotFound())
        const users = yield* Ref.get(store.users)
        const author = users.find((u) => u.id === article.authorId)!
        const follows = yield* Ref.get(store.follows)
        const favs = yield* Ref.get(store.favorites)
        return { article: toArticleBody(article, author, follows, favs, me?.id) }
      }),
    )
    .handle("createArticle", ({ payload }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const id = yield* Ref.getAndUpdate(store.nextArticleId, (n) => n + 1)
        const now = yield* Effect.sync(() => new Date().toISOString())
        const slug = `${slugify(payload.article.title)}-${id}`
        const newArticle: StoredArticle = {
          id,
          slug,
          title: payload.article.title,
          description: payload.article.description,
          body: payload.article.body,
          tagList: (payload.article.tagList ?? []) as Array<string>,
          authorId: currentUser.id,
          createdAt: now,
          updatedAt: now,
        }
        yield* Ref.update(store.articles, (items) => [...items, newArticle])

        // Register new tags
        const existingTags = yield* Ref.get(store.tags)
        const newTags = newArticle.tagList.filter((t) => !existingTags.includes(t))
        if (newTags.length > 0) {
          yield* Ref.update(store.tags, (items) => [...items, ...newTags])
        }

        const follows = yield* Ref.get(store.follows)
        const favs = yield* Ref.get(store.favorites)
        return { article: toArticleBody(newArticle, currentUser, follows, favs, currentUser.id) }
      }),
    )
    .handle("updateArticle", ({ path, payload }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const articles = yield* Ref.get(store.articles)
        const article = articles.find((a) => a.slug === path.slug)
        if (!article) return yield* Effect.fail(new HttpApiError.NotFound())
        if (article.authorId !== currentUser.id)
          return yield* Effect.fail(new HttpApiError.Forbidden())

        const now = yield* Effect.sync(() => new Date().toISOString())
        let updated = { ...article, updatedAt: now }
        if (payload.article.title !== undefined) {
          updated = {
            ...updated,
            title: payload.article.title,
            slug: `${slugify(payload.article.title)}-${article.id}`,
          }
        }
        if (payload.article.description !== undefined) {
          updated = { ...updated, description: payload.article.description }
        }
        if (payload.article.body !== undefined) {
          updated = { ...updated, body: payload.article.body }
        }

        yield* Ref.update(store.articles, (items) =>
          items.map((a) => (a.id === article.id ? updated : a)),
        )
        const users = yield* Ref.get(store.users)
        const author = users.find((u) => u.id === updated.authorId)!
        const follows = yield* Ref.get(store.follows)
        const favs = yield* Ref.get(store.favorites)
        return { article: toArticleBody(updated, author, follows, favs, currentUser.id) }
      }),
    )
    .handle("deleteArticle", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const articles = yield* Ref.get(store.articles)
        const article = articles.find((a) => a.slug === path.slug)
        if (!article) return yield* Effect.fail(new HttpApiError.NotFound())
        if (article.authorId !== currentUser.id)
          return yield* Effect.fail(new HttpApiError.Forbidden())

        yield* Ref.update(store.articles, (items) => items.filter((a) => a.id !== article.id))
        // Also remove associated comments and favorites
        yield* Ref.update(store.comments, (items) =>
          items.filter((c) => c.articleId !== article.id),
        )
        yield* Ref.update(store.favorites, (s) => {
          const next = new Set<string>()
          for (const k of s) {
            if (!k.endsWith(`:${article.id}`)) next.add(k)
          }
          return next
        })
      }),
    ),
)

// ---------------------------------------------------------------------------
// Comments group
// ---------------------------------------------------------------------------

export const CommentsGroupLive = HttpApiBuilder.group(RealWorldApi, "comments", (handlers) =>
  handlers
    .handle("getComments", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const me = yield* tryCurrentUser
        const articles = yield* Ref.get(store.articles)
        const article = articles.find((a) => a.slug === path.slug)
        if (!article) return yield* Effect.fail(new HttpApiError.NotFound())
        const allComments = yield* Ref.get(store.comments)
        const articleComments = allComments.filter((c) => c.articleId === article.id)
        const users = yield* Ref.get(store.users)
        const follows = yield* Ref.get(store.follows)
        const bodies = articleComments.map((c) => {
          const author = users.find((u) => u.id === c.authorId)!
          return toCommentBody(c, author, follows, me?.id)
        })
        return { comments: bodies }
      }),
    )
    .handle("addComment", ({ path, payload }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const articles = yield* Ref.get(store.articles)
        const article = articles.find((a) => a.slug === path.slug)
        if (!article) return yield* Effect.fail(new HttpApiError.NotFound())
        const id = yield* Ref.getAndUpdate(store.nextCommentId, (n) => n + 1)
        const now = yield* Effect.sync(() => new Date().toISOString())
        const newComment = {
          id,
          body: payload.comment.body,
          articleId: article.id,
          authorId: currentUser.id,
          createdAt: now,
          updatedAt: now,
        }
        yield* Ref.update(store.comments, (items) => [...items, newComment])
        const follows = yield* Ref.get(store.follows)
        return { comment: toCommentBody(newComment, currentUser, follows, currentUser.id) }
      }),
    )
    .handle("deleteComment", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const allComments = yield* Ref.get(store.comments)
        const comment = allComments.find((c) => c.id === path.id && c.articleId !== undefined)
        if (!comment) return yield* Effect.fail(new HttpApiError.NotFound())
        if (comment.authorId !== currentUser.id)
          return yield* Effect.fail(new HttpApiError.Forbidden())
        yield* Ref.update(store.comments, (items) => items.filter((c) => c.id !== path.id))
      }),
    ),
)

// ---------------------------------------------------------------------------
// Favorites group
// ---------------------------------------------------------------------------

export const FavoritesGroupLive = HttpApiBuilder.group(RealWorldApi, "favorites", (handlers) =>
  handlers
    .handle("favoriteArticle", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const articles = yield* Ref.get(store.articles)
        const article = articles.find((a) => a.slug === path.slug)
        if (!article) return yield* Effect.fail(new HttpApiError.NotFound())
        yield* Ref.update(
          store.favorites,
          (s) => new Set([...s, favoriteKey(currentUser.id, article.id)]),
        )
        const users = yield* Ref.get(store.users)
        const author = users.find((u) => u.id === article.authorId)!
        const follows = yield* Ref.get(store.follows)
        const favs = yield* Ref.get(store.favorites)
        return { article: toArticleBody(article, author, follows, favs, currentUser.id) }
      }),
    )
    .handle("unfavoriteArticle", ({ path }) =>
      Effect.gen(function* () {
        const store = yield* Store
        const currentUser = yield* CurrentUser
        const articles = yield* Ref.get(store.articles)
        const article = articles.find((a) => a.slug === path.slug)
        if (!article) return yield* Effect.fail(new HttpApiError.NotFound())
        const key = favoriteKey(currentUser.id, article.id)
        yield* Ref.update(store.favorites, (s) => {
          const next = new Set(s)
          next.delete(key)
          return next
        })
        const users = yield* Ref.get(store.users)
        const author = users.find((u) => u.id === article.authorId)!
        const follows = yield* Ref.get(store.follows)
        const favs = yield* Ref.get(store.favorites)
        return { article: toArticleBody(article, author, follows, favs, currentUser.id) }
      }),
    ),
)

// ---------------------------------------------------------------------------
// Tags group
// ---------------------------------------------------------------------------

export const TagsGroupLive = HttpApiBuilder.group(RealWorldApi, "tags", (handlers) =>
  handlers.handle("getTags", () =>
    Effect.gen(function* () {
      const store = yield* Store
      const tags = yield* Ref.get(store.tags)
      return { tags: tags as Array<string> }
    }),
  ),
)
