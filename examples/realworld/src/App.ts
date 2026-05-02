import * as HttpClient from "@effect/platform/HttpClient"
/**
 * RealWorld (Conduit): effect-cycle frontend
 *
 * Full single-page app implementing the RealWorld spec:
 *   - Hash-based routing via RouterSource/RouterSink
 *   - HttpClient for API calls to the backend
 *   - Queue-based action bus (Elm architecture)
 *   - Ref-based state management
 *   - Event delegation on the root element
 *   - Stream-driven rendering via DOMSink
 */
import type * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Effect, Queue, Ref, Schema, type Scope, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"
import { RouterSink, RouterSource, matchPath } from "effect-cycle-router"

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

interface User {
  readonly email: string
  readonly token: string
  readonly username: string
  readonly bio: string | null
  readonly image: string | null
}

interface Author {
  readonly username: string
  readonly bio: string | null
  readonly image: string | null
  readonly following: boolean
}

interface Article {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly body: string
  readonly tagList: ReadonlyArray<string>
  readonly createdAt: string
  readonly updatedAt: string
  readonly favorited: boolean
  readonly favoritesCount: number
  readonly author: Author
}

interface Comment {
  readonly id: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly body: string
  readonly author: Author
}

interface Profile {
  readonly username: string
  readonly bio: string | null
  readonly image: string | null
  readonly following: boolean
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { readonly type: "route-changed"; readonly path: string }
  | { readonly type: "login-submit"; readonly email: string; readonly password: string }
  | {
      readonly type: "register-submit"
      readonly username: string
      readonly email: string
      readonly password: string
    }
  | { readonly type: "logout" }
  | {
      readonly type: "settings-submit"
      readonly image: string
      readonly username: string
      readonly bio: string
      readonly email: string
      readonly password: string
    }
  | {
      readonly type: "set-feed"
      readonly feed: "global" | "your" | "tag"
      readonly tag?: string | undefined
    }
  | { readonly type: "favorite"; readonly slug: string }
  | { readonly type: "unfavorite"; readonly slug: string }
  | { readonly type: "follow"; readonly username: string }
  | { readonly type: "unfollow"; readonly username: string }
  | { readonly type: "add-comment"; readonly slug: string; readonly body: string }
  | { readonly type: "delete-comment"; readonly slug: string; readonly id: number }
  | {
      readonly type: "create-article"
      readonly title: string
      readonly description: string
      readonly body: string
      readonly tagList: string
    }
  | {
      readonly type: "update-article"
      readonly slug: string
      readonly title: string
      readonly description: string
      readonly body: string
    }
  | { readonly type: "delete-article"; readonly slug: string }
  | { readonly type: "set-page"; readonly page: number }
  | {
      readonly type: "articles-loaded"
      readonly articles: ReadonlyArray<Article>
      readonly count: number
    }
  | { readonly type: "article-loaded"; readonly article: Article }
  | { readonly type: "user-loaded"; readonly user: User }
  | { readonly type: "tags-loaded"; readonly tags: ReadonlyArray<string> }
  | { readonly type: "comments-loaded"; readonly comments: ReadonlyArray<Comment> }
  | { readonly type: "profile-loaded"; readonly profile: Profile }
  | {
      readonly type: "profile-articles-loaded"
      readonly articles: ReadonlyArray<Article>
      readonly count: number
    }
  | { readonly type: "api-error"; readonly messages: ReadonlyArray<string> }
  | { readonly type: "set-loading"; readonly loading: boolean }

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AppState {
  readonly user: User | null
  readonly articles: ReadonlyArray<Article>
  readonly articlesCount: number
  readonly tags: ReadonlyArray<string>
  readonly article: Article | null
  readonly comments: ReadonlyArray<Comment>
  readonly profile: Profile | null
  readonly profileArticles: ReadonlyArray<Article>
  readonly profileArticlesCount: number
  readonly errors: ReadonlyArray<string>
  readonly currentPath: string
  readonly feedType: "global" | "your" | "tag"
  readonly activeTag: string | null
  readonly loading: boolean
  readonly currentPage: number
  readonly editingArticle: Article | null
}

interface Refs {
  readonly user: Ref.Ref<User | null>
  readonly articles: Ref.Ref<ReadonlyArray<Article>>
  readonly articlesCount: Ref.Ref<number>
  readonly tags: Ref.Ref<ReadonlyArray<string>>
  readonly article: Ref.Ref<Article | null>
  readonly comments: Ref.Ref<ReadonlyArray<Comment>>
  readonly profile: Ref.Ref<Profile | null>
  readonly profileArticles: Ref.Ref<ReadonlyArray<Article>>
  readonly profileArticlesCount: Ref.Ref<number>
  readonly errors: Ref.Ref<ReadonlyArray<string>>
  readonly currentPath: Ref.Ref<string>
  readonly feedType: Ref.Ref<"global" | "your" | "tag">
  readonly activeTag: Ref.Ref<string | null>
  readonly loading: Ref.Ref<boolean>
  readonly currentPage: Ref.Ref<number>
  readonly editingArticle: Ref.Ref<Article | null>
}

const readState = (refs: Refs): Effect.Effect<AppState> =>
  Effect.all({
    user: Ref.get(refs.user),
    articles: Ref.get(refs.articles),
    articlesCount: Ref.get(refs.articlesCount),
    tags: Ref.get(refs.tags),
    article: Ref.get(refs.article),
    comments: Ref.get(refs.comments),
    profile: Ref.get(refs.profile),
    profileArticles: Ref.get(refs.profileArticles),
    profileArticlesCount: Ref.get(refs.profileArticlesCount),
    errors: Ref.get(refs.errors),
    currentPath: Ref.get(refs.currentPath),
    feedType: Ref.get(refs.feedType),
    activeTag: Ref.get(refs.activeTag),
    loading: Ref.get(refs.loading),
    currentPage: Ref.get(refs.currentPage),
    editingArticle: Ref.get(refs.editingArticle),
  })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

const defaultAvatar = "https://api.realworld.io/images/smiley-cyrus.jpeg"

const avatarUrl = (image: string | null): string => image || defaultAvatar

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

type Client = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | HttpClientError.ResponseError,
  Scope.Scope
>

type ApiError = HttpClientError.HttpClientError | HttpClientError.ResponseError

const apiGet = (client: Client, url: string, token: string | null) => {
  const req = HttpClientRequest.get(url)
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.scoped,
  ) as Effect.Effect<unknown, ApiError>
}

const apiPost = (client: Client, url: string, body: unknown, token: string | null) => {
  const req = HttpClientRequest.post(url).pipe(HttpClientRequest.bodyUnsafeJson(body))
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.scoped,
  ) as Effect.Effect<unknown, ApiError>
}

const apiPut = (client: Client, url: string, body: unknown, token: string | null) => {
  const req = HttpClientRequest.put(url).pipe(HttpClientRequest.bodyUnsafeJson(body))
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.scoped,
  ) as Effect.Effect<unknown, ApiError>
}

const apiDelete = (client: Client, url: string, token: string | null) => {
  const req = HttpClientRequest.del(url)
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.scoped,
  ) as Effect.Effect<unknown, ApiError>
}

// Parse error messages from API error responses
const ApiErrorBodySchema = Schema.Union(
  Schema.Struct({
    errors: Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.Array(Schema.String), Schema.String),
    }),
  }),
  Schema.Struct({ message: Schema.String }),
)

const flattenErrorBody = (
  body: Schema.Schema.Type<typeof ApiErrorBodySchema>,
): ReadonlyArray<string> => {
  if ("errors" in body) {
    return Object.entries(body.errors).flatMap(([field, msgs]) =>
      Array.isArray(msgs) ? msgs.map((m) => `${field} ${m}`) : [`${field} ${msgs}`],
    )
  }
  return [body.message]
}

const parseErrors = (err: ApiError): ReadonlyArray<string> => {
  if (err._tag === "ResponseError") {
    if (err.response.status === 401) return ["Unauthorized. Please sign in again."]
    if (err.response.status === 403) return ["Forbidden. You don't have permission."]
    if (err.response.status === 404) return ["Not found."]
  }

  // Try parsing message as a JSON error body. Decoded structure tells us
  // which shape we got, so no `as` casts.
  try {
    const raw: unknown = JSON.parse(err.message)
    const decoded = Schema.decodeUnknownEither(ApiErrorBodySchema)(raw)
    if (decoded._tag === "Right") {
      const parsed = flattenErrorBody(decoded.right)
      if (parsed.length > 0) return parsed
    }
  } catch {
    // not JSON: fall through
  }

  if (err.message && err.message !== "non 2xx status code") return [err.message]
  return ["An error occurred"]
}

// Check if an error is a 401 and clear token if so
const is401 = (err: ApiError): boolean =>
  err._tag === "ResponseError" && err.response.status === 401

const handleApiError = (
  err: ApiError,
  refs: Refs,
  actions: Queue.Queue<Action>,
  fallbackMsg: string,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (is401(err)) {
      yield* Ref.set(refs.user, null)
      yield* Effect.sync(() => localStorage.removeItem("conduit-token"))
    }
    const messages = parseErrors(err)
    yield* Queue.offer(actions, {
      type: "api-error",
      messages: messages[0] === "An error occurred" ? [fallbackMsg] : messages,
    })
  })

// ---------------------------------------------------------------------------
// Action handler
// ---------------------------------------------------------------------------

const handleAction = (
  action: Action,
  refs: Refs,
  client: Client,
  actions: Queue.Queue<Action>,
  routerSink: RouterSink["Type"],
): Effect.Effect<void> => {
  const getToken = (): Effect.Effect<string | null> =>
    Ref.get(refs.user).pipe(Effect.map((u) => (u ? u.token : null)))

  const forkApi = (eff: Effect.Effect<void>): Effect.Effect<void> =>
    Effect.fork(eff).pipe(Effect.asVoid)

  switch (action.type) {
    case "route-changed": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.currentPath, action.path)
        yield* Ref.set(refs.errors, [])
        yield* Ref.set(refs.loading, true)
        yield* Ref.set(refs.currentPage, 0)
        yield* Ref.set(refs.editingArticle, null)

        const token = yield* getToken()
        const path = action.path

        // Use matchPath for routes with named parameters
        const articleMatch = matchPath("/article/:slug", path)
        const editorMatch = matchPath("/editor/:slug", path)

        if (path === "/" || path === "") {
          yield* Ref.set(refs.feedType, "global")
          yield* Ref.set(refs.activeTag, null)
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(client, "/api/articles?limit=20", token)
              const data = json as { articles: Article[]; articlesCount: number }
              yield* Queue.offer(actions, {
                type: "articles-loaded",
                articles: data.articles,
                count: data.articlesCount,
              })
            }).pipe(
              Effect.catchAll((err) =>
                handleApiError(err, refs, actions, "Failed to load articles"),
              ),
              Effect.asVoid,
            ),
          )
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(client, "/api/tags", token)
              const data = json as { tags: string[] }
              yield* Queue.offer(actions, { type: "tags-loaded", tags: data.tags })
            }).pipe(
              Effect.catchAll(() => Effect.void),
              Effect.asVoid,
            ),
          )
        } else if (editorMatch) {
          // Editing an existing article (slug extracted by matchPath)
          const slug = editorMatch["slug"]!
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(client, `/api/articles/${encodeURIComponent(slug)}`, token)
              const data = json as { article: Article }
              yield* Ref.set(refs.editingArticle, data.article)
              yield* Ref.set(refs.loading, false)
            }).pipe(
              Effect.catchAll((err) =>
                handleApiError(err, refs, actions, "Failed to load article"),
              ),
              Effect.asVoid,
            ),
          )
        } else if (path === "/editor") {
          yield* Ref.set(refs.loading, false)
        } else if (articleMatch) {
          // View article (slug extracted by matchPath)
          const slug = articleMatch["slug"]!
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(client, `/api/articles/${encodeURIComponent(slug)}`, token)
              const data = json as { article: Article }
              yield* Queue.offer(actions, { type: "article-loaded", article: data.article })
            }).pipe(
              Effect.catchAll((err) => handleApiError(err, refs, actions, "Article not found")),
              Effect.asVoid,
            ),
          )
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(
                client,
                `/api/articles/${encodeURIComponent(slug)}/comments`,
                token,
              )
              const data = json as { comments: Comment[] }
              yield* Queue.offer(actions, { type: "comments-loaded", comments: data.comments })
            }).pipe(
              Effect.catchAll(() => Effect.void),
              Effect.asVoid,
            ),
          )
        } else if (path.startsWith("/@")) {
          // Profile routes use @ prefix which doesn't fit matchPath's :param syntax
          const rest = path.slice(2)
          const isFavorites = rest.endsWith("/favorites")
          const username = isFavorites ? rest.slice(0, -"/favorites".length) : rest
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(
                client,
                `/api/profiles/${encodeURIComponent(username)}`,
                token,
              )
              const data = json as { profile: Profile }
              yield* Queue.offer(actions, { type: "profile-loaded", profile: data.profile })
            }).pipe(
              Effect.catchAll((err) => handleApiError(err, refs, actions, "Profile not found")),
              Effect.asVoid,
            ),
          )
          const articlesUrl = isFavorites
            ? `/api/articles?favorited=${encodeURIComponent(username)}&limit=20`
            : `/api/articles?author=${encodeURIComponent(username)}&limit=20`
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(client, articlesUrl, token)
              const data = json as { articles: Article[]; articlesCount: number }
              yield* Queue.offer(actions, {
                type: "profile-articles-loaded",
                articles: data.articles,
                count: data.articlesCount,
              })
            }).pipe(
              Effect.catchAll(() => Effect.void),
              Effect.asVoid,
            ),
          )
        } else if (path === "/login" || path === "/register" || path === "/settings") {
          yield* Ref.set(refs.loading, false)
        } else {
          yield* Ref.set(refs.loading, false)
        }
      })
    }

    case "login-submit": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.loading, true)
        yield* Ref.set(refs.errors, [])
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiPost(
              client,
              "/api/users/login",
              { user: { email: action.email, password: action.password } },
              null,
            )
            const data = json as { user: User }
            yield* Queue.offer(actions, { type: "user-loaded", user: data.user })
          }).pipe(
            Effect.catchAll((err) => {
              const messages = parseErrors(err)
              return Queue.offer(actions, { type: "api-error", messages })
            }),
            Effect.asVoid,
          ),
        )
      })
    }

    case "register-submit": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.loading, true)
        yield* Ref.set(refs.errors, [])
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiPost(
              client,
              "/api/users",
              {
                user: {
                  username: action.username,
                  email: action.email,
                  password: action.password,
                },
              },
              null,
            )
            const data = json as { user: User }
            yield* Queue.offer(actions, { type: "user-loaded", user: data.user })
          }).pipe(
            Effect.catchAll((err) => {
              const messages = parseErrors(err)
              return Queue.offer(actions, { type: "api-error", messages })
            }),
            Effect.asVoid,
          ),
        )
      })
    }

    case "logout": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.user, null)
        yield* Effect.sync(() => localStorage.removeItem("conduit-token"))
        yield* routerSink.push("/").pipe(Effect.orDie)
      })
    }

    case "settings-submit": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.loading, true)
        yield* Ref.set(refs.errors, [])
        const token = yield* getToken()
        const user: Record<string, string> = {}
        if (action.image) user["image"] = action.image
        if (action.username) user["username"] = action.username
        if (action.bio) user["bio"] = action.bio
        if (action.email) user["email"] = action.email
        if (action.password) user["password"] = action.password
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiPut(client, "/api/user", { user }, token)
            const data = json as { user: User }
            yield* Queue.offer(actions, { type: "user-loaded", user: data.user })
          }).pipe(
            Effect.catchAll((err) => {
              const messages = parseErrors(err)
              return Queue.offer(actions, { type: "api-error", messages })
            }),
            Effect.asVoid,
          ),
        )
      })
    }

    case "set-feed": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.feedType, action.feed)
        yield* Ref.set(refs.activeTag, action.tag ?? null)
        yield* Ref.set(refs.loading, true)
        yield* Ref.set(refs.currentPage, 0)
        const token = yield* getToken()
        const url =
          action.feed === "your"
            ? "/api/articles/feed?limit=20"
            : action.feed === "tag"
              ? `/api/articles?tag=${encodeURIComponent(action.tag!)}&limit=20`
              : "/api/articles?limit=20"
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiGet(client, url, token)
            const data = json as { articles: Article[]; articlesCount: number }
            yield* Queue.offer(actions, {
              type: "articles-loaded",
              articles: data.articles,
              count: data.articlesCount,
            })
          }).pipe(
            Effect.catchAll((err) => handleApiError(err, refs, actions, "Failed to load feed")),
            Effect.asVoid,
          ),
        )
      })
    }

    case "favorite": {
      return Effect.gen(function* () {
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiPost(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/favorite`,
              {},
              token,
            )
            const data = json as { article: Article }
            yield* Ref.update(refs.articles, (arts) =>
              arts.map((a) => (a.slug === data.article.slug ? data.article : a)),
            )
            const current = yield* Ref.get(refs.article)
            if (current && current.slug === data.article.slug) {
              yield* Ref.set(refs.article, data.article)
            }
          }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid,
          ),
        )
      })
    }

    case "unfavorite": {
      return Effect.gen(function* () {
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiDelete(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/favorite`,
              token,
            )
            const data = json as { article: Article }
            yield* Ref.update(refs.articles, (arts) =>
              arts.map((a) => (a.slug === data.article.slug ? data.article : a)),
            )
            const current = yield* Ref.get(refs.article)
            if (current && current.slug === data.article.slug) {
              yield* Ref.set(refs.article, data.article)
            }
          }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid,
          ),
        )
      })
    }

    case "follow": {
      return Effect.gen(function* () {
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiPost(
              client,
              `/api/profiles/${encodeURIComponent(action.username)}/follow`,
              {},
              token,
            )
            const data = json as { profile: Profile }
            yield* Queue.offer(actions, { type: "profile-loaded", profile: data.profile })
          }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid,
          ),
        )
      })
    }

    case "unfollow": {
      return Effect.gen(function* () {
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiDelete(
              client,
              `/api/profiles/${encodeURIComponent(action.username)}/follow`,
              token,
            )
            const data = json as { profile: Profile }
            yield* Queue.offer(actions, { type: "profile-loaded", profile: data.profile })
          }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid,
          ),
        )
      })
    }

    case "add-comment": {
      return Effect.gen(function* () {
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            yield* apiPost(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/comments`,
              { comment: { body: action.body } },
              token,
            )
            const commentsJson = yield* apiGet(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/comments`,
              token,
            )
            const data = commentsJson as { comments: Comment[] }
            yield* Queue.offer(actions, { type: "comments-loaded", comments: data.comments })
          }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid,
          ),
        )
      })
    }

    case "delete-comment": {
      return Effect.gen(function* () {
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            yield* apiDelete(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/comments/${action.id}`,
              token,
            )
            yield* Ref.update(refs.comments, (cs) => cs.filter((c) => c.id !== action.id))
          }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid,
          ),
        )
      })
    }

    case "create-article": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.loading, true)
        yield* Ref.set(refs.errors, [])
        const token = yield* getToken()
        const tagList = action.tagList
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiPost(
              client,
              "/api/articles",
              {
                article: {
                  title: action.title,
                  description: action.description,
                  body: action.body,
                  tagList,
                },
              },
              token,
            )
            const data = json as { article: Article }
            yield* Ref.set(refs.loading, false)
            yield* routerSink.push(`/article/${data.article.slug}`).pipe(Effect.orDie)
          }).pipe(
            Effect.catchAll((err) =>
              Effect.gen(function* () {
                yield* Ref.set(refs.loading, false)
                const messages = parseErrors(err)
                yield* Queue.offer(actions, { type: "api-error", messages })
              }),
            ),
            Effect.asVoid,
          ),
        )
      })
    }

    case "update-article": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.loading, true)
        yield* Ref.set(refs.errors, [])
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            const json = yield* apiPut(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}`,
              {
                article: {
                  title: action.title,
                  description: action.description,
                  body: action.body,
                },
              },
              token,
            )
            const data = json as { article: Article }
            yield* Ref.set(refs.loading, false)
            yield* routerSink.push(`/article/${data.article.slug}`).pipe(Effect.orDie)
          }).pipe(
            Effect.catchAll((err) =>
              Effect.gen(function* () {
                yield* Ref.set(refs.loading, false)
                yield* handleApiError(err, refs, actions, "Failed to update article")
              }),
            ),
            Effect.asVoid,
          ),
        )
      })
    }

    case "delete-article": {
      return Effect.gen(function* () {
        const token = yield* getToken()
        yield* forkApi(
          Effect.gen(function* () {
            yield* apiDelete(client, `/api/articles/${encodeURIComponent(action.slug)}`, token)
            yield* routerSink.push("/").pipe(Effect.orDie)
          }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid,
          ),
        )
      })
    }

    case "set-page": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.currentPage, action.page)
        yield* Ref.set(refs.loading, true)
        const token = yield* getToken()
        const feedType = yield* Ref.get(refs.feedType)
        const activeTag = yield* Ref.get(refs.activeTag)
        const path = yield* Ref.get(refs.currentPath)
        const offset = action.page * 20

        if (path.startsWith("/@")) {
          // Profile page pagination
          const rest = path.slice(2)
          const isFavorites = rest.endsWith("/favorites")
          const username = isFavorites ? rest.slice(0, -"/favorites".length) : rest
          const url = isFavorites
            ? `/api/articles?favorited=${encodeURIComponent(username)}&limit=20&offset=${offset}`
            : `/api/articles?author=${encodeURIComponent(username)}&limit=20&offset=${offset}`
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(client, url, token)
              const data = json as { articles: Article[]; articlesCount: number }
              yield* Queue.offer(actions, {
                type: "profile-articles-loaded",
                articles: data.articles,
                count: data.articlesCount,
              })
            }).pipe(
              Effect.catchAll((err) =>
                handleApiError(err, refs, actions, "Failed to load articles"),
              ),
              Effect.asVoid,
            ),
          )
        } else {
          // Home page pagination
          const url =
            feedType === "your"
              ? `/api/articles/feed?limit=20&offset=${offset}`
              : feedType === "tag" && activeTag
                ? `/api/articles?tag=${encodeURIComponent(activeTag)}&limit=20&offset=${offset}`
                : `/api/articles?limit=20&offset=${offset}`
          yield* forkApi(
            Effect.gen(function* () {
              const json = yield* apiGet(client, url, token)
              const data = json as { articles: Article[]; articlesCount: number }
              yield* Queue.offer(actions, {
                type: "articles-loaded",
                articles: data.articles,
                count: data.articlesCount,
              })
            }).pipe(
              Effect.catchAll((err) =>
                handleApiError(err, refs, actions, "Failed to load articles"),
              ),
              Effect.asVoid,
            ),
          )
        }
      })
    }

    // --- Response actions (update state) ---

    case "articles-loaded": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.articles, action.articles)
        yield* Ref.set(refs.articlesCount, action.count)
        yield* Ref.set(refs.loading, false)
      })
    }

    case "article-loaded": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.article, action.article)
        yield* Ref.set(refs.loading, false)
      })
    }

    case "user-loaded": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.user, action.user)
        yield* Ref.set(refs.loading, false)
        yield* Effect.sync(() => localStorage.setItem("conduit-token", action.user.token))
        const path = yield* Ref.get(refs.currentPath)
        if (path === "/login" || path === "/register") {
          yield* routerSink.push("/").pipe(Effect.orDie)
        }
      })
    }

    case "tags-loaded": {
      return Ref.set(refs.tags, action.tags)
    }

    case "comments-loaded": {
      return Ref.set(refs.comments, action.comments)
    }

    case "profile-loaded": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.profile, action.profile)
        yield* Ref.set(refs.loading, false)
      })
    }

    case "profile-articles-loaded": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.profileArticles, action.articles)
        yield* Ref.set(refs.profileArticlesCount, action.count)
        yield* Ref.set(refs.loading, false)
      })
    }

    case "api-error": {
      return Effect.gen(function* () {
        yield* Ref.set(refs.errors, action.messages)
        yield* Ref.set(refs.loading, false)
      })
    }

    case "set-loading": {
      return Ref.set(refs.loading, action.loading)
    }
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const renderNav = (user: User | null, currentPath: string): string => {
  const navLink = (href: string, label: string, icon?: string): string => {
    const active = currentPath === href ? " active" : ""
    const content = icon ? `<i class="${icon}"></i>&nbsp;${label}` : label
    return `<li><a href="#${href}" class="nav-link${active}">${content}</a></li>`
  }

  const links = user
    ? [
        navLink("/", "Home"),
        navLink("/editor", "New Article", "ion-compose"),
        navLink("/settings", "Settings", "ion-gear-a"),
        navLink(`/@${user.username}`, user.username),
      ]
    : [navLink("/", "Home"), navLink("/login", "Sign in"), navLink("/register", "Sign up")]

  return `
    <nav class="navbar">
      <div class="container">
        <a class="navbar-brand" href="#/">conduit</a>
        <ul class="nav-links">${links.join("")}</ul>
      </div>
    </nav>`
}

const renderFooter = (): string => `
  <footer class="app-footer">
    <div class="container">
      <a href="#/" class="navbar-brand">conduit</a>
      <span>An interactive learning project from <a href="https://thinkster.io">Thinkster</a>.
      Code licensed under MIT.</span>
    </div>
  </footer>`

const renderBanner = (): string => `
  <div class="banner">
    <div class="container">
      <h1>conduit</h1>
      <p>A place to share your knowledge.</p>
    </div>
  </div>`

const renderErrors = (errors: ReadonlyArray<string>): string => {
  if (errors.length === 0) return ""
  return `<ul class="error-messages">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
}

const renderArticlePreview = (article: Article): string => {
  const favClass = article.favorited ? "btn-outline-primary favorited" : "btn-outline-primary"
  const favAction = article.favorited ? "unfavorite" : "favorite"
  return `
    <div class="article-preview">
      <div class="article-meta">
        <a href="#/@${escapeHtml(article.author.username)}">
          <img src="${avatarUrl(article.author.image)}" alt="" />
        </a>
        <div class="info">
          <a class="author" href="#/@${escapeHtml(article.author.username)}">${escapeHtml(article.author.username)}</a>
          <span class="date">${formatDate(article.createdAt)}</span>
        </div>
        <div class="favorite-btn">
          <button class="${favClass}" data-action="${favAction}" data-slug="${escapeHtml(article.slug)}">
            <i class="ion-heart"></i> ${article.favoritesCount}
          </button>
        </div>
      </div>
      <a href="#/article/${escapeHtml(article.slug)}" class="preview-link">
        <h2>${escapeHtml(article.title)}</h2>
        <p>${escapeHtml(article.description)}</p>
        <span class="read-more">Read more...</span>
        ${article.tagList.length > 0 ? `<ul class="tag-list">${article.tagList.map((t) => `<li class="tag-pill tag-default">${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
      </a>
    </div>`
}

const renderPagination = (totalCount: number, currentPage: number): string => {
  const totalPages = Math.ceil(totalCount / 20)
  if (totalPages <= 1) return ""
  const pages: string[] = []
  for (let i = 0; i < totalPages; i++) {
    const active = i === currentPage ? " active" : ""
    pages.push(
      `<li><a class="page-link${active}" href="#" data-action="set-page" data-page="${i}">${i + 1}</a></li>`,
    )
  }
  return `<nav class="pagination"><ul>${pages.join("")}</ul></nav>`
}

const renderHomePage = (state: AppState): string => {
  const feedTabs: string[] = []

  if (state.user) {
    const yourActive = state.feedType === "your" ? " active" : ""
    feedTabs.push(
      `<li><a class="feed-tab${yourActive}" href="#" data-feed="your">Your Feed</a></li>`,
    )
  }

  const globalActive = state.feedType === "global" ? " active" : ""
  feedTabs.push(
    `<li><a class="feed-tab${globalActive}" href="#" data-feed="global">Global Feed</a></li>`,
  )

  if (state.feedType === "tag" && state.activeTag) {
    feedTabs.push(
      `<li><a class="feed-tab active" href="#" data-feed="tag" data-tag="${escapeHtml(state.activeTag)}"># ${escapeHtml(state.activeTag)}</a></li>`,
    )
  }

  const articles = state.loading
    ? '<div class="article-preview">Loading articles...</div>'
    : state.articles.length === 0
      ? '<div class="article-preview">No articles are here... yet.</div>'
      : state.articles.map(renderArticlePreview).join("")

  const tags =
    state.loading && state.tags.length === 0
      ? "<p>Loading tags...</p>"
      : state.tags.length === 0
        ? '<p>Popular Tags</p><p style="color:#aaa;font-size:14px">No tags yet.</p>'
        : `<p>Popular Tags</p>
       <div class="tag-list">
         ${state.tags.map((t) => `<a class="tag-pill" href="#" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</a>`).join("")}
       </div>`

  return `
    ${state.user ? "" : renderBanner()}
    <div class="home-page">
      <div class="container">
        <div class="feed-container">
          <div class="feed-toggle">
            <ul>${feedTabs.join("")}</ul>
          </div>
          ${articles}
          ${renderPagination(state.articlesCount, state.currentPage)}
        </div>
        <div class="sidebar-container">
          <div class="sidebar">
            ${tags}
          </div>
        </div>
      </div>
    </div>`
}

const renderLoginPage = (state: AppState): string => `
  <div class="auth-page">
    <h1>Sign in</h1>
    <p><a href="#/register">Need an account?</a></p>
    ${renderErrors(state.errors)}
    <form id="login-form">
      <div class="form-group">
        <input type="email" name="email" placeholder="Email" required />
      </div>
      <div class="form-group">
        <input type="password" name="password" placeholder="Password" required />
      </div>
      <button class="btn" type="submit"${state.loading ? " disabled" : ""}>Sign in</button>
    </form>
  </div>`

const renderRegisterPage = (state: AppState): string => `
  <div class="auth-page">
    <h1>Sign up</h1>
    <p><a href="#/login">Have an account?</a></p>
    ${renderErrors(state.errors)}
    <form id="register-form">
      <div class="form-group">
        <input type="text" name="username" placeholder="Username" required />
      </div>
      <div class="form-group">
        <input type="email" name="email" placeholder="Email" required />
      </div>
      <div class="form-group">
        <input type="password" name="password" placeholder="Password" required />
      </div>
      <button class="btn" type="submit"${state.loading ? " disabled" : ""}>Sign up</button>
    </form>
  </div>`

const renderSettingsPage = (state: AppState): string => {
  const u = state.user
  if (!u) return "<p>Please sign in.</p>"
  return `
    <div class="auth-page">
      <h1>Your Settings</h1>
      ${renderErrors(state.errors)}
      <form id="settings-form">
        <div class="form-group">
          <input type="text" name="image" placeholder="URL of profile picture" value="${escapeHtml(u.image || "")}" />
        </div>
        <div class="form-group">
          <input type="text" name="username" placeholder="Username" value="${escapeHtml(u.username)}" required />
        </div>
        <div class="form-group">
          <textarea name="bio" placeholder="Short bio about you" rows="8" style="width:100%;padding:12px;font-size:16px;border:1px solid #ccc;border-radius:4px;font-family:inherit">${escapeHtml(u.bio || "")}</textarea>
        </div>
        <div class="form-group">
          <input type="email" name="email" placeholder="Email" value="${escapeHtml(u.email)}" required />
        </div>
        <div class="form-group">
          <input type="password" name="password" placeholder="New Password" />
        </div>
        <button class="btn" type="submit"${state.loading ? " disabled" : ""}>Update Settings</button>
      </form>
      <hr style="margin:24px 0" />
      <button class="btn btn-outline-danger" id="logout-btn" type="button">Or click here to logout.</button>
    </div>`
}

const renderEditorPage = (state: AppState): string => {
  const a = state.editingArticle
  const isEditing = a !== null
  const title = a ? escapeHtml(a.title) : ""
  const description = a ? escapeHtml(a.description) : ""
  const body = a ? escapeHtml(a.body) : ""
  const tagList = a ? escapeHtml(a.tagList.join(", ")) : ""
  const slug = a ? escapeHtml(a.slug) : ""

  if (isEditing && state.loading && !a) return '<div class="container"><p>Loading...</p></div>'

  return `
    <div class="auth-page">
      <h1>${isEditing ? "Edit Article" : "New Article"}</h1>
      ${renderErrors(state.errors)}
      <form id="editor-form"${isEditing ? ` data-slug="${slug}"` : ""}>
        <div class="form-group">
          <input type="text" name="title" placeholder="Article Title" value="${title}" required />
        </div>
        <div class="form-group">
          <input type="text" name="description" placeholder="What's this article about?" value="${description}" required />
        </div>
        <div class="form-group">
          <textarea name="body" placeholder="Write your article (in markdown)" rows="12" style="width:100%;padding:12px;font-size:16px;border:1px solid #ccc;border-radius:4px;font-family:inherit" required>${body}</textarea>
        </div>
        <div class="form-group">
          <input type="text" name="tagList" placeholder="Enter tags (comma separated)" value="${tagList}" />
        </div>
        <button class="btn" type="submit"${state.loading ? " disabled" : ""}>${isEditing ? "Update Article" : "Publish Article"}</button>
      </form>
    </div>`
}

const renderArticlePage = (state: AppState): string => {
  if (state.loading && !state.article) return '<div class="container"><p>Loading...</p></div>'
  const a = state.article
  if (!a) return '<div class="container"><p>Article not found.</p></div>'

  const isAuthor = state.user !== null && state.user.username === a.author.username
  const followBtn =
    state.user && !isAuthor
      ? a.author.following
        ? `<button class="btn-outline-primary" data-action="unfollow" data-username="${escapeHtml(a.author.username)}">
           <i class="ion-minus-round"></i> Unfollow ${escapeHtml(a.author.username)}
         </button>`
        : `<button class="btn-outline-primary" data-action="follow" data-username="${escapeHtml(a.author.username)}">
           <i class="ion-plus-round"></i> Follow ${escapeHtml(a.author.username)}
         </button>`
      : ""

  const favBtn = state.user
    ? a.favorited
      ? `<button class="btn-outline-primary" data-action="unfavorite" data-slug="${escapeHtml(a.slug)}">
           <i class="ion-heart"></i> Unfavorite Article (${a.favoritesCount})
         </button>`
      : `<button class="btn-outline-primary" data-action="favorite" data-slug="${escapeHtml(a.slug)}">
           <i class="ion-heart"></i> Favorite Article (${a.favoritesCount})
         </button>`
    : ""

  const editBtn = isAuthor
    ? `<a href="#/editor/${escapeHtml(a.slug)}" class="btn-outline-primary" style="text-decoration:none">
         <i class="ion-edit"></i> Edit Article
       </a>`
    : ""

  const deleteBtn = isAuthor
    ? `<button class="btn-outline-danger" data-action="delete-article" data-slug="${escapeHtml(a.slug)}">
         <i class="ion-trash-a"></i> Delete Article
       </button>`
    : ""

  const articleMeta = `
    <div class="article-meta">
      <a href="#/@${escapeHtml(a.author.username)}">
        <img src="${avatarUrl(a.author.image)}" alt="" />
      </a>
      <div class="info">
        <a class="author" href="#/@${escapeHtml(a.author.username)}">${escapeHtml(a.author.username)}</a>
        <span class="date">${formatDate(a.createdAt)}</span>
      </div>
      ${followBtn} ${favBtn} ${editBtn} ${deleteBtn}
    </div>`

  const commentForm = state.user
    ? `<form class="comment-form" id="comment-form" data-slug="${escapeHtml(a.slug)}">
         <textarea placeholder="Write a comment..." name="comment-body"></textarea>
         <div class="card-footer">
           <img src="${avatarUrl(state.user.image)}" alt="" style="width:30px;height:30px;border-radius:50%" />
           <button class="btn btn-outline-primary" type="submit">Post Comment</button>
         </div>
       </form>`
    : '<p><a href="#/login">Sign in</a> or <a href="#/register">sign up</a> to add comments on this article.</p>'

  const comments = state.comments
    .map((c) => {
      const canDelete = state.user !== null && state.user.username === c.author.username
      return `
        <div class="comment">
          <div class="card-block"><p>${escapeHtml(c.body)}</p></div>
          <div class="card-footer">
            <a href="#/@${escapeHtml(c.author.username)}">
              <img src="${avatarUrl(c.author.image)}" alt="" />
            </a>
            <a class="author" href="#/@${escapeHtml(c.author.username)}">${escapeHtml(c.author.username)}</a>
            <span class="date">${formatDate(c.createdAt)}</span>
            ${canDelete ? `<span class="mod-options"><i class="ion-trash-a" data-action="delete-comment" data-slug="${escapeHtml(a.slug)}" data-id="${c.id}" style="cursor:pointer;margin-left:auto"></i></span>` : ""}
          </div>
        </div>`
    })
    .join("")

  return `
    <div class="article-page">
      <div class="banner">
        <div class="container">
          <h1>${escapeHtml(a.title)}</h1>
          ${articleMeta}
        </div>
      </div>
      <div class="container">
        <div class="article-content">
          <p>${escapeHtml(a.body)}</p>
        </div>
        <hr />
        ${articleMeta}
        <div style="max-width:660px;margin:24px auto">
          ${commentForm}
          ${comments}
        </div>
      </div>
    </div>`
}

const renderProfilePage = (state: AppState): string => {
  if (state.loading && !state.profile) return '<div class="container"><p>Loading...</p></div>'
  const p = state.profile
  if (!p) return '<div class="container"><p>Profile not found.</p></div>'

  const isMe = state.user !== null && state.user.username === p.username
  const followBtn =
    state.user && !isMe
      ? p.following
        ? `<button class="btn-outline-primary" data-action="unfollow" data-username="${escapeHtml(p.username)}">
             <i class="ion-minus-round"></i> Unfollow ${escapeHtml(p.username)}
           </button>`
        : `<button class="btn-outline-primary" data-action="follow" data-username="${escapeHtml(p.username)}">
             <i class="ion-plus-round"></i> Follow ${escapeHtml(p.username)}
           </button>`
      : ""

  const isFavorites = state.currentPath.endsWith("/favorites")
  const myArticlesActive = !isFavorites ? " active" : ""
  const favArticlesActive = isFavorites ? " active" : ""

  const articles =
    state.profileArticles.length === 0
      ? '<div class="article-preview">No articles are here... yet.</div>'
      : state.profileArticles.map(renderArticlePreview).join("")

  return `
    <div class="profile-page">
      <div class="banner" style="background:#f3f3f3;color:#373a3c">
        <div class="container" style="text-align:center">
          <img src="${avatarUrl(p.image)}" alt="" style="width:100px;height:100px;border-radius:50%;margin-bottom:16px" />
          <h1 style="font-size:28px;text-shadow:none">${escapeHtml(p.username)}</h1>
          <p style="font-weight:300;color:#aaa">${p.bio ? escapeHtml(p.bio) : ""}</p>
          ${followBtn}
        </div>
      </div>
      <div class="container">
        <div class="feed-toggle">
          <ul>
            <li><a class="feed-tab${myArticlesActive}" href="#/@${escapeHtml(p.username)}">My Articles</a></li>
            <li><a class="feed-tab${favArticlesActive}" href="#/@${escapeHtml(p.username)}/favorites">Favorited Articles</a></li>
          </ul>
        </div>
        ${articles}
          ${renderPagination(state.profileArticlesCount, state.currentPage)}
      </div>
    </div>`
}

const renderPage = (state: AppState): string => {
  const path = state.currentPath
  if (path === "/login") return renderLoginPage(state)
  if (path === "/register") return renderRegisterPage(state)
  if (path === "/settings") return renderSettingsPage(state)
  if (path === "/editor" || path.startsWith("/editor/")) return renderEditorPage(state)
  if (path.startsWith("/article/")) return renderArticlePage(state)
  if (path.startsWith("/@")) return renderProfilePage(state)
  return renderHomePage(state)
}

const renderApp = (state: AppState): string =>
  `<div id="root">${renderNav(state.user, state.currentPath)}${renderPage(state)}${renderFooter()}</div>`

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink
  const router = yield* RouterSource
  const routerSink = yield* RouterSink
  const rawClient = yield* HttpClient.HttpClient
  const client = HttpClient.filterStatusOk(rawClient)

  // Initialize refs
  const refs: Refs = {
    user: yield* Ref.make<User | null>(null),
    articles: yield* Ref.make<ReadonlyArray<Article>>([]),
    articlesCount: yield* Ref.make(0),
    tags: yield* Ref.make<ReadonlyArray<string>>([]),
    article: yield* Ref.make<Article | null>(null),
    comments: yield* Ref.make<ReadonlyArray<Comment>>([]),
    profile: yield* Ref.make<Profile | null>(null),
    profileArticles: yield* Ref.make<ReadonlyArray<Article>>([]),
    profileArticlesCount: yield* Ref.make(0),
    errors: yield* Ref.make<ReadonlyArray<string>>([]),
    currentPath: yield* Ref.make("/"),
    feedType: yield* Ref.make<"global" | "your" | "tag">("global"),
    activeTag: yield* Ref.make<string | null>(null),
    loading: yield* Ref.make(true),
    currentPage: yield* Ref.make(0),
    editingArticle: yield* Ref.make<Article | null>(null),
  }

  // Action bus
  const actions = yield* Queue.unbounded<Action>()
  const offer = (action: Action) => Queue.unsafeOffer(actions, action)

  // Restore saved token and fetch current user
  yield* Effect.gen(function* () {
    const saved = yield* Effect.sync(() => localStorage.getItem("conduit-token"))
    if (saved) {
      yield* Effect.fork(
        Effect.gen(function* () {
          const json = yield* apiGet(client, "/api/user", saved)
          const data = json as { user: User }
          yield* Queue.offer(actions, { type: "user-loaded", user: data.user })
        }).pipe(
          Effect.catchAll(() => Effect.sync(() => localStorage.removeItem("conduit-token"))),
          Effect.asVoid,
        ),
      )
    }
  })

  // Listen to route changes
  yield* Effect.fork(
    Stream.runForEach(router.location$, (loc) =>
      Queue.offer(actions, { type: "route-changed", path: loc.path }),
    ),
  )

  // Event delegation
  const root = yield* dom.element

  yield* Effect.sync(() => {
    root.addEventListener("submit", (ev: Event) => {
      ev.preventDefault()
      const form = ev.target as HTMLFormElement
      const data = new FormData(form)

      if (form.id === "login-form") {
        offer({
          type: "login-submit",
          email: (data.get("email") as string) || "",
          password: (data.get("password") as string) || "",
        })
      } else if (form.id === "register-form") {
        offer({
          type: "register-submit",
          username: (data.get("username") as string) || "",
          email: (data.get("email") as string) || "",
          password: (data.get("password") as string) || "",
        })
      } else if (form.id === "settings-form") {
        offer({
          type: "settings-submit",
          image: (data.get("image") as string) || "",
          username: (data.get("username") as string) || "",
          bio: (data.get("bio") as string) || "",
          email: (data.get("email") as string) || "",
          password: (data.get("password") as string) || "",
        })
      } else if (form.id === "editor-form") {
        const slug = form.getAttribute("data-slug") || ""
        if (slug) {
          offer({
            type: "update-article",
            slug,
            title: (data.get("title") as string) || "",
            description: (data.get("description") as string) || "",
            body: (data.get("body") as string) || "",
          })
        } else {
          offer({
            type: "create-article",
            title: (data.get("title") as string) || "",
            description: (data.get("description") as string) || "",
            body: (data.get("body") as string) || "",
            tagList: (data.get("tagList") as string) || "",
          })
        }
      } else if (form.id === "comment-form") {
        const slug = form.getAttribute("data-slug") || ""
        const bodyField = form.querySelector(
          "textarea[name='comment-body']",
        ) as HTMLTextAreaElement | null
        offer({ type: "add-comment", slug, body: bodyField?.value || "" })
        if (bodyField) bodyField.value = ""
      }
    })

    root.addEventListener("click", (ev: Event) => {
      const target = ev.target as HTMLElement
      const btn = target.closest("[data-action]") as HTMLElement | null
      if (btn) {
        ev.preventDefault()
        const actionName = btn.getAttribute("data-action") || ""
        const slug = btn.getAttribute("data-slug") || ""
        const username = btn.getAttribute("data-username") || ""
        const id = btn.getAttribute("data-id") || "0"

        switch (actionName) {
          case "favorite":
            offer({ type: "favorite", slug })
            break
          case "unfavorite":
            offer({ type: "unfavorite", slug })
            break
          case "follow":
            offer({ type: "follow", username })
            break
          case "unfollow":
            offer({ type: "unfollow", username })
            break
          case "delete-article":
            offer({ type: "delete-article", slug })
            break
          case "delete-comment":
            offer({ type: "delete-comment", slug, id: Number.parseInt(id, 10) })
            break
          case "set-page": {
            const page = btn.getAttribute("data-page") || "0"
            offer({ type: "set-page", page: Number.parseInt(page, 10) })
            break
          }
        }
        return
      }

      // Feed tab clicks
      const feedTab = target.closest(".feed-tab") as HTMLElement | null
      if (feedTab) {
        ev.preventDefault()
        const feed = (feedTab.getAttribute("data-feed") || "global") as "global" | "your" | "tag"
        const tag = feedTab.getAttribute("data-tag") || undefined
        offer({ type: "set-feed", feed, tag })
        return
      }

      // Tag pill clicks in sidebar
      const tagPill = target.closest(".sidebar .tag-pill") as HTMLElement | null
      if (tagPill) {
        ev.preventDefault()
        const tag = tagPill.getAttribute("data-tag") || tagPill.textContent || ""
        offer({ type: "set-feed", feed: "tag", tag })
        return
      }

      // Logout button
      if (target.id === "logout-btn" || target.closest("#logout-btn")) {
        ev.preventDefault()
        offer({ type: "logout" })
      }
    })
  })

  // Render stream
  const vdom$: Stream.Stream<string> = Stream.concat(
    Stream.make(undefined as undefined),
    Stream.fromQueue(actions).pipe(
      Stream.tap((action) => handleAction(action, refs, client, actions, routerSink)),
    ),
  ).pipe(
    Stream.mapEffect(() => readState(refs)),
    Stream.map(renderApp),
  )

  yield* sink.render(vdom$)
  yield* Effect.never
})

export default app
