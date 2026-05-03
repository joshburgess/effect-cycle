import * as HttpClient from "@effect/platform/HttpClient"
/**
 * RealWorld (Conduit): effect-cycle frontend (tachys renderer)
 *
 * Full single-page app implementing the RealWorld spec:
 *   - Hash-based routing via RouterSource/RouterSink
 *   - HttpClient for API calls to the backend
 *   - Queue-based action bus (Elm architecture)
 *   - Ref-based state management
 *   - Event delegation on the root element
 *   - Stream-driven rendering with the tachys vDOM renderer (`tachys/sync`)
 *
 * Architecture notes:
 *   `DOMSource` comes from `effect-cycle-dom`, while the renderer-specific
 *   `DOMSink` (and the `DOMDriverLive` wired up in main.ts) come from
 *   `effect-cycle-tachys`. The Action-bus pattern is identical to the
 *   morphdom variant; tachys-rendered DOM bubbles events the same way real
 *   DOM does, so `addEventListener` on the persistent root + `closest`/
 *   `matches` continues to work unchanged.
 */
import type * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Data, Effect, Queue, Ref, Schema, type Scope, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { RouterSink, RouterSource, matchPath } from "effect-cycle-router"
import { DOMSink, type VNode } from "effect-cycle-tachys"
import { h } from "tachys/sync"

// ---------------------------------------------------------------------------
// Domain schemas (validate API responses at the boundary)
// ---------------------------------------------------------------------------

const AuthorSchema = Schema.Struct({
  username: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  following: Schema.Boolean,
})

const UserSchema = Schema.Struct({
  email: Schema.String,
  token: Schema.String,
  username: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
})

const ArticleSchema = Schema.Struct({
  slug: Schema.String,
  title: Schema.String,
  description: Schema.String,
  body: Schema.String,
  tagList: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  favorited: Schema.Boolean,
  favoritesCount: Schema.Number,
  author: AuthorSchema,
})

const CommentSchema = Schema.Struct({
  id: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  body: Schema.String,
  author: AuthorSchema,
})

const ProfileSchema = Schema.Struct({
  username: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  following: Schema.Boolean,
})

type Author = Schema.Schema.Type<typeof AuthorSchema>
type User = Schema.Schema.Type<typeof UserSchema>
type Article = Schema.Schema.Type<typeof ArticleSchema>
type Comment = Schema.Schema.Type<typeof CommentSchema>
type Profile = Schema.Schema.Type<typeof ProfileSchema>

const SingleUserResponse = Schema.Struct({ user: UserSchema })
const SingleArticleResponse = Schema.Struct({ article: ArticleSchema })
const MultipleArticlesResponse = Schema.Struct({
  articles: Schema.Array(ArticleSchema),
  articlesCount: Schema.Number,
})
const TagsResponse = Schema.Struct({ tags: Schema.Array(Schema.String) })
const SingleProfileResponse = Schema.Struct({ profile: ProfileSchema })
const MultipleCommentsResponse = Schema.Struct({ comments: Schema.Array(CommentSchema) })

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

class ApiDecodeError extends Data.TaggedError("ApiDecodeError")<{
  readonly url: string
  readonly message: string
}> {}

class ApiValidationError extends Data.TaggedError("ApiValidationError")<{
  readonly status: number
  readonly messages: ReadonlyArray<string>
}> {}

type ApiError =
  | HttpClientError.HttpClientError
  | HttpClientError.ResponseError
  | ApiDecodeError
  | ApiValidationError

// Conduit returns either { errors: { field: [msg] } } (422) or { message } (4xx/5xx).
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

// Upgrade a ResponseError into an ApiValidationError when the body parses as
// the Conduit error envelope. Falls back to passing the ResponseError through.
const enrichResponseError = (
  err: HttpClientError.ResponseError,
): Effect.Effect<never, HttpClientError.ResponseError | ApiValidationError> =>
  Effect.gen(function* () {
    const text = yield* err.response.text.pipe(Effect.orElseSucceed(() => ""))
    if (!text) return yield* Effect.fail(err)
    const parsed = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: () => err,
    }).pipe(Effect.catchAll(() => Effect.fail(err)))
    const decoded = yield* Schema.decodeUnknown(ApiErrorBodySchema)(parsed).pipe(
      Effect.catchAll(() => Effect.fail(err)),
    )
    return yield* Effect.fail(
      new ApiValidationError({
        status: err.response.status,
        messages: flattenErrorBody(decoded),
      }),
    )
  })

const decodeBody =
  <A, I>(schema: Schema.Schema<A, I>, url: string) =>
  (json: unknown): Effect.Effect<A, ApiDecodeError> =>
    Schema.decodeUnknown(schema)(json).pipe(
      Effect.mapError((cause) => new ApiDecodeError({ url, message: String(cause) })),
    )

const apiGet = <A, I>(
  client: Client,
  url: string,
  token: string | null,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ApiError> => {
  const req = HttpClientRequest.get(url)
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.flatMap(decodeBody(schema, url)),
    Effect.catchTag("ResponseError", enrichResponseError),
    Effect.scoped,
    Effect.withSpan(`api.GET ${url}`),
  )
}

const apiPost = <A, I>(
  client: Client,
  url: string,
  body: unknown,
  token: string | null,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ApiError> => {
  const req = HttpClientRequest.post(url).pipe(HttpClientRequest.bodyUnsafeJson(body))
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.flatMap(decodeBody(schema, url)),
    Effect.catchTag("ResponseError", enrichResponseError),
    Effect.scoped,
    Effect.withSpan(`api.POST ${url}`),
  )
}

const apiPostVoid = (
  client: Client,
  url: string,
  body: unknown,
  token: string | null,
): Effect.Effect<void, ApiError> => {
  const req = HttpClientRequest.post(url).pipe(HttpClientRequest.bodyUnsafeJson(body))
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client
    .execute(authed)
    .pipe(
      Effect.asVoid,
      Effect.catchTag("ResponseError", enrichResponseError),
      Effect.scoped,
      Effect.withSpan(`api.POST ${url}`),
    )
}

const apiPut = <A, I>(
  client: Client,
  url: string,
  body: unknown,
  token: string | null,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ApiError> => {
  const req = HttpClientRequest.put(url).pipe(HttpClientRequest.bodyUnsafeJson(body))
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.flatMap(decodeBody(schema, url)),
    Effect.catchTag("ResponseError", enrichResponseError),
    Effect.scoped,
    Effect.withSpan(`api.PUT ${url}`),
  )
}

const apiDelete = <A, I>(
  client: Client,
  url: string,
  token: string | null,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ApiError> => {
  const req = HttpClientRequest.del(url)
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client.execute(authed).pipe(
    Effect.flatMap((res) => res.json),
    Effect.flatMap(decodeBody(schema, url)),
    Effect.catchTag("ResponseError", enrichResponseError),
    Effect.scoped,
    Effect.withSpan(`api.DELETE ${url}`),
  )
}

const apiDeleteVoid = (
  client: Client,
  url: string,
  token: string | null,
): Effect.Effect<void, ApiError> => {
  const req = HttpClientRequest.del(url)
  const authed = token ? HttpClientRequest.bearerToken(req, token) : req
  return client
    .execute(authed)
    .pipe(
      Effect.asVoid,
      Effect.catchTag("ResponseError", enrichResponseError),
      Effect.scoped,
      Effect.withSpan(`api.DELETE ${url}`),
    )
}

const parseErrors = (err: ApiError): ReadonlyArray<string> => {
  if (err._tag === "ApiDecodeError") {
    return ["Server response could not be decoded."]
  }
  if (err._tag === "ApiValidationError") {
    if (err.status === 401) return ["Unauthorized. Please sign in again."]
    if (err.status === 403) return ["Forbidden. You don't have permission."]
    if (err.status === 404) return ["Not found."]
    return err.messages.length > 0 ? err.messages : ["An error occurred"]
  }
  if (err._tag === "ResponseError") {
    if (err.response.status === 401) return ["Unauthorized. Please sign in again."]
    if (err.response.status === 403) return ["Forbidden. You don't have permission."]
    if (err.response.status === 404) return ["Not found."]
    if (err.message && err.message !== "non 2xx status code") return [err.message]
  }
  return ["An error occurred"]
}

// Check if an error is a 401 and clear token if so
const is401 = (err: ApiError): boolean =>
  (err._tag === "ResponseError" && err.response.status === 401) ||
  (err._tag === "ApiValidationError" && err.status === 401)

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
  scope: Scope.Scope,
): Effect.Effect<void> => {
  const getToken = (): Effect.Effect<string | null> =>
    Ref.get(refs.user).pipe(Effect.map((u) => (u ? u.token : null)))

  const forkApi = (eff: Effect.Effect<void>): Effect.Effect<void> =>
    Effect.forkIn(scope)(eff).pipe(Effect.asVoid)

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
              const data = yield* apiGet(
                client,
                "/api/articles?limit=20",
                token,
                MultipleArticlesResponse,
              )
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
              const data = yield* apiGet(client, "/api/tags", token, TagsResponse)
              yield* Queue.offer(actions, { type: "tags-loaded", tags: data.tags })
            }).pipe(
              Effect.tapError((err) =>
                Effect.logWarning("API call failed").pipe(
                  Effect.annotateLogs({
                    context: "load-tags",
                    message: parseErrors(err)[0] ?? "",
                  }),
                ),
              ),
              Effect.catchAll(() => Effect.void),
              Effect.asVoid,
            ),
          )
        } else if (editorMatch) {
          // Editing an existing article (slug extracted by matchPath)
          const slug = editorMatch["slug"]!
          yield* forkApi(
            Effect.gen(function* () {
              const data = yield* apiGet(
                client,
                `/api/articles/${encodeURIComponent(slug)}`,
                token,
                SingleArticleResponse,
              )
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
              const data = yield* apiGet(
                client,
                `/api/articles/${encodeURIComponent(slug)}`,
                token,
                SingleArticleResponse,
              )
              yield* Queue.offer(actions, { type: "article-loaded", article: data.article })
            }).pipe(
              Effect.catchAll((err) => handleApiError(err, refs, actions, "Article not found")),
              Effect.asVoid,
            ),
          )
          yield* forkApi(
            Effect.gen(function* () {
              const data = yield* apiGet(
                client,
                `/api/articles/${encodeURIComponent(slug)}/comments`,
                token,
                MultipleCommentsResponse,
              )
              yield* Queue.offer(actions, { type: "comments-loaded", comments: data.comments })
            }).pipe(
              Effect.tapError((err) =>
                Effect.logWarning("API call failed").pipe(
                  Effect.annotateLogs({
                    context: "load-comments",
                    message: parseErrors(err)[0] ?? "",
                  }),
                ),
              ),
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
              const data = yield* apiGet(
                client,
                `/api/profiles/${encodeURIComponent(username)}`,
                token,
                SingleProfileResponse,
              )
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
              const data = yield* apiGet(client, articlesUrl, token, MultipleArticlesResponse)
              yield* Queue.offer(actions, {
                type: "profile-articles-loaded",
                articles: data.articles,
                count: data.articlesCount,
              })
            }).pipe(
              Effect.tapError((err) =>
                Effect.logWarning("API call failed").pipe(
                  Effect.annotateLogs({
                    context: "load-profile-articles",
                    message: parseErrors(err)[0] ?? "",
                  }),
                ),
              ),
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
            const data = yield* apiPost(
              client,
              "/api/users/login",
              { user: { email: action.email, password: action.password } },
              null,
              SingleUserResponse,
            )
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
            const data = yield* apiPost(
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
              SingleUserResponse,
            )
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
            const data = yield* apiPut(client, "/api/user", { user }, token, SingleUserResponse)
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
            const data = yield* apiGet(client, url, token, MultipleArticlesResponse)
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
            const data = yield* apiPost(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/favorite`,
              {},
              token,
              SingleArticleResponse,
            )
            yield* Ref.update(refs.articles, (arts) =>
              arts.map((a) => (a.slug === data.article.slug ? data.article : a)),
            )
            const current = yield* Ref.get(refs.article)
            if (current && current.slug === data.article.slug) {
              yield* Ref.set(refs.article, data.article)
            }
          }).pipe(
            Effect.tapError((err) =>
              Effect.logWarning("API call failed").pipe(
                Effect.annotateLogs({
                  context: "favorite",
                  message: parseErrors(err)[0] ?? "",
                }),
              ),
            ),
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
            const data = yield* apiDelete(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/favorite`,
              token,
              SingleArticleResponse,
            )
            yield* Ref.update(refs.articles, (arts) =>
              arts.map((a) => (a.slug === data.article.slug ? data.article : a)),
            )
            const current = yield* Ref.get(refs.article)
            if (current && current.slug === data.article.slug) {
              yield* Ref.set(refs.article, data.article)
            }
          }).pipe(
            Effect.tapError((err) =>
              Effect.logWarning("API call failed").pipe(
                Effect.annotateLogs({
                  context: "unfavorite",
                  message: parseErrors(err)[0] ?? "",
                }),
              ),
            ),
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
            const data = yield* apiPost(
              client,
              `/api/profiles/${encodeURIComponent(action.username)}/follow`,
              {},
              token,
              SingleProfileResponse,
            )
            yield* Queue.offer(actions, { type: "profile-loaded", profile: data.profile })
          }).pipe(
            Effect.tapError((err) =>
              Effect.logWarning("API call failed").pipe(
                Effect.annotateLogs({
                  context: "follow",
                  message: parseErrors(err)[0] ?? "",
                }),
              ),
            ),
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
            const data = yield* apiDelete(
              client,
              `/api/profiles/${encodeURIComponent(action.username)}/follow`,
              token,
              SingleProfileResponse,
            )
            yield* Queue.offer(actions, { type: "profile-loaded", profile: data.profile })
          }).pipe(
            Effect.tapError((err) =>
              Effect.logWarning("API call failed").pipe(
                Effect.annotateLogs({
                  context: "unfollow",
                  message: parseErrors(err)[0] ?? "",
                }),
              ),
            ),
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
            yield* apiPostVoid(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/comments`,
              { comment: { body: action.body } },
              token,
            )
            const data = yield* apiGet(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/comments`,
              token,
              MultipleCommentsResponse,
            )
            yield* Queue.offer(actions, { type: "comments-loaded", comments: data.comments })
          }).pipe(
            Effect.tapError((err) =>
              Effect.logWarning("API call failed").pipe(
                Effect.annotateLogs({
                  context: "add-comment",
                  message: parseErrors(err)[0] ?? "",
                }),
              ),
            ),
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
            yield* apiDeleteVoid(
              client,
              `/api/articles/${encodeURIComponent(action.slug)}/comments/${action.id}`,
              token,
            )
            yield* Ref.update(refs.comments, (cs) => cs.filter((c) => c.id !== action.id))
          }).pipe(
            Effect.tapError((err) =>
              Effect.logWarning("API call failed").pipe(
                Effect.annotateLogs({
                  context: "delete-comment",
                  message: parseErrors(err)[0] ?? "",
                }),
              ),
            ),
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
            const data = yield* apiPost(
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
              SingleArticleResponse,
            )
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
            const data = yield* apiPut(
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
              SingleArticleResponse,
            )
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
            yield* apiDeleteVoid(client, `/api/articles/${encodeURIComponent(action.slug)}`, token)
            yield* routerSink.push("/").pipe(Effect.orDie)
          }).pipe(
            Effect.tapError((err) =>
              Effect.logWarning("API call failed").pipe(
                Effect.annotateLogs({
                  context: "delete-article",
                  message: parseErrors(err)[0] ?? "",
                }),
              ),
            ),
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
              const data = yield* apiGet(client, url, token, MultipleArticlesResponse)
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
              const data = yield* apiGet(client, url, token, MultipleArticlesResponse)
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
// Views (tachys VNode trees)
// ---------------------------------------------------------------------------

// Inline-style helpers (tachys requires CSS objects, not strings; setProperty
// uses kebab-case).
const textareaStyle = {
  width: "100%",
  padding: "12px",
  fontSize: "16px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  fontFamily: "inherit",
} as const

const renderNav = (user: User | null, currentPath: string): VNode => {
  const navLink = (href: string, label: string, icon?: string): VNode => {
    const active = currentPath === href ? " active" : ""
    return h(
      "li",
      null,
      h(
        "a",
        { href: `#${href}`, className: `nav-link${active}` },
        icon ? [h("i", { className: icon }), " ", label] : label,
      ),
    )
  }

  const links = user
    ? [
        navLink("/", "Home"),
        navLink("/editor", "New Article", "ion-compose"),
        navLink("/settings", "Settings", "ion-gear-a"),
        navLink(`/@${user.username}`, user.username),
      ]
    : [navLink("/", "Home"), navLink("/login", "Sign in"), navLink("/register", "Sign up")]

  return h(
    "nav",
    { className: "navbar" },
    h(
      "div",
      { className: "container" },
      h("a", { className: "navbar-brand", href: "#/" }, "conduit"),
      h("ul", { className: "nav-links" }, links),
    ),
  )
}

const renderFooter = (): VNode =>
  h(
    "footer",
    { className: "app-footer" },
    h(
      "div",
      { className: "container" },
      h("a", { href: "#/", className: "navbar-brand" }, "conduit"),
      h(
        "span",
        null,
        "An interactive learning project from ",
        h("a", { href: "https://thinkster.io" }, "Thinkster"),
        ". Code licensed under MIT.",
      ),
    ),
  )

const renderBanner = (): VNode =>
  h(
    "div",
    { className: "banner" },
    h(
      "div",
      { className: "container" },
      h("h1", null, "conduit"),
      h("p", null, "A place to share your knowledge."),
    ),
  )

const renderErrors = (errors: ReadonlyArray<string>): VNode | null => {
  if (errors.length === 0) return null
  return h(
    "ul",
    { className: "error-messages" },
    errors.map((e) => h("li", null, e)),
  )
}

const renderAuthorAvatar = (author: Author): VNode =>
  h("a", { href: `#/@${author.username}` }, h("img", { src: avatarUrl(author.image), alt: "" }))

const renderArticlePreview = (article: Article): VNode => {
  const favClass = article.favorited ? "btn-outline-primary favorited" : "btn-outline-primary"
  const favAction = article.favorited ? "unfavorite" : "favorite"
  return h(
    "div",
    { className: "article-preview", key: article.slug },
    h(
      "div",
      { className: "article-meta" },
      renderAuthorAvatar(article.author),
      h(
        "div",
        { className: "info" },
        h(
          "a",
          { className: "author", href: `#/@${article.author.username}` },
          article.author.username,
        ),
        h("span", { className: "date" }, formatDate(article.createdAt)),
      ),
      h(
        "div",
        { className: "favorite-btn" },
        h(
          "button",
          { className: favClass, "data-action": favAction, "data-slug": article.slug },
          h("i", { className: "ion-heart" }),
          ` ${article.favoritesCount}`,
        ),
      ),
    ),
    h(
      "a",
      { href: `#/article/${article.slug}`, className: "preview-link" },
      h("h2", null, article.title),
      h("p", null, article.description),
      h("span", { className: "read-more" }, "Read more..."),
      article.tagList.length > 0
        ? h(
            "ul",
            { className: "tag-list" },
            article.tagList.map((t) => h("li", { className: "tag-pill tag-default" }, t)),
          )
        : null,
    ),
  )
}

const renderPagination = (totalCount: number, currentPage: number): VNode | null => {
  const totalPages = Math.ceil(totalCount / 20)
  if (totalPages <= 1) return null
  const pages: Array<VNode> = []
  for (let i = 0; i < totalPages; i++) {
    const active = i === currentPage ? " active" : ""
    pages.push(
      h(
        "li",
        { key: i },
        h(
          "a",
          {
            className: `page-link${active}`,
            href: "#",
            "data-action": "set-page",
            "data-page": String(i),
          },
          String(i + 1),
        ),
      ),
    )
  }
  return h("nav", { className: "pagination" }, h("ul", null, pages))
}

const renderHomePage = (state: AppState): VNode => {
  const feedTabs: Array<VNode> = []

  if (state.user) {
    const yourActive = state.feedType === "your" ? " active" : ""
    feedTabs.push(
      h(
        "li",
        { key: "your" },
        h("a", { className: `feed-tab${yourActive}`, href: "#", "data-feed": "your" }, "Your Feed"),
      ),
    )
  }

  const globalActive = state.feedType === "global" ? " active" : ""
  feedTabs.push(
    h(
      "li",
      { key: "global" },
      h(
        "a",
        { className: `feed-tab${globalActive}`, href: "#", "data-feed": "global" },
        "Global Feed",
      ),
    ),
  )

  if (state.feedType === "tag" && state.activeTag) {
    feedTabs.push(
      h(
        "li",
        { key: `tag-${state.activeTag}` },
        h(
          "a",
          {
            className: "feed-tab active",
            href: "#",
            "data-feed": "tag",
            "data-tag": state.activeTag,
          },
          `# ${state.activeTag}`,
        ),
      ),
    )
  }

  const articles: VNode | Array<VNode> = state.loading
    ? h("div", { className: "article-preview" }, "Loading articles...")
    : state.articles.length === 0
      ? h("div", { className: "article-preview" }, "No articles are here... yet.")
      : state.articles.map(renderArticlePreview)

  const tagsBlock: Array<VNode> =
    state.loading && state.tags.length === 0
      ? [h("p", null, "Loading tags...")]
      : state.tags.length === 0
        ? [
            h("p", null, "Popular Tags"),
            h("p", { style: { color: "#aaa", fontSize: "14px" } }, "No tags yet."),
          ]
        : [
            h("p", null, "Popular Tags"),
            h(
              "div",
              { className: "tag-list" },
              state.tags.map((t) =>
                h("a", { className: "tag-pill", href: "#", "data-tag": t, key: t }, t),
              ),
            ),
          ]

  return h(
    "div",
    null,
    state.user ? null : renderBanner(),
    h(
      "div",
      { className: "home-page" },
      h(
        "div",
        { className: "container" },
        h(
          "div",
          { className: "feed-container" },
          h("div", { className: "feed-toggle" }, h("ul", null, feedTabs)),
          articles,
          renderPagination(state.articlesCount, state.currentPage),
        ),
        h("div", { className: "sidebar-container" }, h("div", { className: "sidebar" }, tagsBlock)),
      ),
    ),
  )
}

const renderLoginPage = (state: AppState): VNode =>
  h(
    "div",
    { className: "auth-page" },
    h("h1", null, "Sign in"),
    h("p", null, h("a", { href: "#/register" }, "Need an account?")),
    renderErrors(state.errors),
    h(
      "form",
      { id: "login-form" },
      h(
        "div",
        { className: "form-group" },
        h("input", { type: "email", name: "email", placeholder: "Email", required: true }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "password",
          name: "password",
          placeholder: "Password",
          required: true,
        }),
      ),
      h("button", { className: "btn", type: "submit", disabled: state.loading }, "Sign in"),
    ),
  )

const renderRegisterPage = (state: AppState): VNode =>
  h(
    "div",
    { className: "auth-page" },
    h("h1", null, "Sign up"),
    h("p", null, h("a", { href: "#/login" }, "Have an account?")),
    renderErrors(state.errors),
    h(
      "form",
      { id: "register-form" },
      h(
        "div",
        { className: "form-group" },
        h("input", { type: "text", name: "username", placeholder: "Username", required: true }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", { type: "email", name: "email", placeholder: "Email", required: true }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "password",
          name: "password",
          placeholder: "Password",
          required: true,
        }),
      ),
      h("button", { className: "btn", type: "submit", disabled: state.loading }, "Sign up"),
    ),
  )

const renderSettingsPage = (state: AppState): VNode => {
  const u = state.user
  if (!u) return h("p", null, "Please sign in.")
  return h(
    "div",
    { className: "auth-page" },
    h("h1", null, "Your Settings"),
    renderErrors(state.errors),
    h(
      "form",
      { id: "settings-form" },
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "text",
          name: "image",
          placeholder: "URL of profile picture",
          value: u.image || "",
        }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "text",
          name: "username",
          placeholder: "Username",
          value: u.username,
          required: true,
        }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("textarea", {
          name: "bio",
          placeholder: "Short bio about you",
          rows: 8,
          style: textareaStyle,
          value: u.bio || "",
        }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "email",
          name: "email",
          placeholder: "Email",
          value: u.email,
          required: true,
        }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", { type: "password", name: "password", placeholder: "New Password" }),
      ),
      h("button", { className: "btn", type: "submit", disabled: state.loading }, "Update Settings"),
    ),
    h("hr", { style: { margin: "24px 0" } }),
    h(
      "button",
      { className: "btn btn-outline-danger", id: "logout-btn", type: "button" },
      "Or click here to logout.",
    ),
  )
}

const renderEditorPage = (state: AppState): VNode => {
  const a = state.editingArticle
  const isEditing = a !== null

  if (isEditing && state.loading && !a) {
    return h("div", { className: "container" }, h("p", null, "Loading..."))
  }

  const formProps =
    isEditing && a
      ? ({ id: "editor-form", "data-slug": a.slug } as const)
      : ({ id: "editor-form" } as const)

  return h(
    "div",
    { className: "auth-page" },
    h("h1", null, isEditing ? "Edit Article" : "New Article"),
    renderErrors(state.errors),
    h(
      "form",
      formProps,
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "text",
          name: "title",
          placeholder: "Article Title",
          value: a ? a.title : "",
          required: true,
        }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "text",
          name: "description",
          placeholder: "What's this article about?",
          value: a ? a.description : "",
          required: true,
        }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("textarea", {
          name: "body",
          placeholder: "Write your article (in markdown)",
          rows: 12,
          style: textareaStyle,
          required: true,
          value: a ? a.body : "",
        }),
      ),
      h(
        "div",
        { className: "form-group" },
        h("input", {
          type: "text",
          name: "tagList",
          placeholder: "Enter tags (comma separated)",
          value: a ? a.tagList.join(", ") : "",
        }),
      ),
      h(
        "button",
        { className: "btn", type: "submit", disabled: state.loading },
        isEditing ? "Update Article" : "Publish Article",
      ),
    ),
  )
}

const renderArticleMeta = (a: Article, state: AppState): VNode => {
  const isAuthor = state.user !== null && state.user.username === a.author.username
  const followBtn: VNode | null =
    state.user && !isAuthor
      ? a.author.following
        ? h(
            "button",
            {
              className: "btn-outline-primary",
              "data-action": "unfollow",
              "data-username": a.author.username,
            },
            h("i", { className: "ion-minus-round" }),
            ` Unfollow ${a.author.username}`,
          )
        : h(
            "button",
            {
              className: "btn-outline-primary",
              "data-action": "follow",
              "data-username": a.author.username,
            },
            h("i", { className: "ion-plus-round" }),
            ` Follow ${a.author.username}`,
          )
      : null

  const favBtn: VNode | null = state.user
    ? a.favorited
      ? h(
          "button",
          {
            className: "btn-outline-primary",
            "data-action": "unfavorite",
            "data-slug": a.slug,
          },
          h("i", { className: "ion-heart" }),
          ` Unfavorite Article (${a.favoritesCount})`,
        )
      : h(
          "button",
          {
            className: "btn-outline-primary",
            "data-action": "favorite",
            "data-slug": a.slug,
          },
          h("i", { className: "ion-heart" }),
          ` Favorite Article (${a.favoritesCount})`,
        )
    : null

  const editBtn: VNode | null = isAuthor
    ? h(
        "a",
        {
          href: `#/editor/${a.slug}`,
          className: "btn-outline-primary",
          style: { textDecoration: "none" },
        },
        h("i", { className: "ion-edit" }),
        " Edit Article",
      )
    : null

  const deleteBtn: VNode | null = isAuthor
    ? h(
        "button",
        {
          className: "btn-outline-danger",
          "data-action": "delete-article",
          "data-slug": a.slug,
        },
        h("i", { className: "ion-trash-a" }),
        " Delete Article",
      )
    : null

  return h(
    "div",
    { className: "article-meta" },
    renderAuthorAvatar(a.author),
    h(
      "div",
      { className: "info" },
      h("a", { className: "author", href: `#/@${a.author.username}` }, a.author.username),
      h("span", { className: "date" }, formatDate(a.createdAt)),
    ),
    followBtn,
    " ",
    favBtn,
    " ",
    editBtn,
    " ",
    deleteBtn,
  )
}

const renderComment = (c: Comment, articleSlug: string, state: AppState): VNode => {
  const canDelete = state.user !== null && state.user.username === c.author.username
  return h(
    "div",
    { className: "comment", key: c.id },
    h("div", { className: "card-block" }, h("p", null, c.body)),
    h(
      "div",
      { className: "card-footer" },
      h(
        "a",
        { href: `#/@${c.author.username}` },
        h("img", { src: avatarUrl(c.author.image), alt: "" }),
      ),
      h("a", { className: "author", href: `#/@${c.author.username}` }, c.author.username),
      h("span", { className: "date" }, formatDate(c.createdAt)),
      canDelete
        ? h(
            "span",
            { className: "mod-options" },
            h("i", {
              className: "ion-trash-a",
              "data-action": "delete-comment",
              "data-slug": articleSlug,
              "data-id": String(c.id),
              style: { cursor: "pointer", marginLeft: "auto" },
            }),
          )
        : null,
    ),
  )
}

const renderArticlePage = (state: AppState): VNode => {
  if (state.loading && !state.article) {
    return h("div", { className: "container" }, h("p", null, "Loading..."))
  }
  const a = state.article
  if (!a) return h("div", { className: "container" }, h("p", null, "Article not found."))

  const commentForm: VNode = state.user
    ? h(
        "form",
        { className: "comment-form", id: "comment-form", "data-slug": a.slug },
        h("textarea", { placeholder: "Write a comment...", name: "comment-body" }),
        h(
          "div",
          { className: "card-footer" },
          h("img", {
            src: avatarUrl(state.user.image),
            alt: "",
            style: { width: "30px", height: "30px", borderRadius: "50%" },
          }),
          h("button", { className: "btn btn-outline-primary", type: "submit" }, "Post Comment"),
        ),
      )
    : h(
        "p",
        null,
        h("a", { href: "#/login" }, "Sign in"),
        " or ",
        h("a", { href: "#/register" }, "sign up"),
        " to add comments on this article.",
      )

  return h(
    "div",
    { className: "article-page" },
    h(
      "div",
      { className: "banner" },
      h("div", { className: "container" }, h("h1", null, a.title), renderArticleMeta(a, state)),
    ),
    h(
      "div",
      { className: "container" },
      h("div", { className: "article-content" }, h("p", null, a.body)),
      h("hr", null),
      renderArticleMeta(a, state),
      h(
        "div",
        { style: { maxWidth: "660px", margin: "24px auto" } },
        commentForm,
        ...state.comments.map((c) => renderComment(c, a.slug, state)),
      ),
    ),
  )
}

const renderProfilePage = (state: AppState): VNode => {
  if (state.loading && !state.profile) {
    return h("div", { className: "container" }, h("p", null, "Loading..."))
  }
  const p = state.profile
  if (!p) return h("div", { className: "container" }, h("p", null, "Profile not found."))

  const isMe = state.user !== null && state.user.username === p.username
  const followBtn: VNode | null =
    state.user && !isMe
      ? p.following
        ? h(
            "button",
            {
              className: "btn-outline-primary",
              "data-action": "unfollow",
              "data-username": p.username,
            },
            h("i", { className: "ion-minus-round" }),
            ` Unfollow ${p.username}`,
          )
        : h(
            "button",
            {
              className: "btn-outline-primary",
              "data-action": "follow",
              "data-username": p.username,
            },
            h("i", { className: "ion-plus-round" }),
            ` Follow ${p.username}`,
          )
      : null

  const isFavorites = state.currentPath.endsWith("/favorites")
  const myArticlesActive = !isFavorites ? " active" : ""
  const favArticlesActive = isFavorites ? " active" : ""

  const articles: VNode | Array<VNode> =
    state.profileArticles.length === 0
      ? h("div", { className: "article-preview" }, "No articles are here... yet.")
      : state.profileArticles.map(renderArticlePreview)

  return h(
    "div",
    { className: "profile-page" },
    h(
      "div",
      { className: "banner", style: { background: "#f3f3f3", color: "#373a3c" } },
      h(
        "div",
        { className: "container", style: { textAlign: "center" } },
        h("img", {
          src: avatarUrl(p.image),
          alt: "",
          style: {
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            marginBottom: "16px",
          },
        }),
        h("h1", { style: { fontSize: "28px", textShadow: "none" } }, p.username),
        h("p", { style: { fontWeight: "300", color: "#aaa" } }, p.bio ? p.bio : ""),
        followBtn,
      ),
    ),
    h(
      "div",
      { className: "container" },
      h(
        "div",
        { className: "feed-toggle" },
        h(
          "ul",
          null,
          h(
            "li",
            null,
            h(
              "a",
              { className: `feed-tab${myArticlesActive}`, href: `#/@${p.username}` },
              "My Articles",
            ),
          ),
          h(
            "li",
            null,
            h(
              "a",
              {
                className: `feed-tab${favArticlesActive}`,
                href: `#/@${p.username}/favorites`,
              },
              "Favorited Articles",
            ),
          ),
        ),
      ),
      articles,
      renderPagination(state.profileArticlesCount, state.currentPage),
    ),
  )
}

const renderPage = (state: AppState): VNode => {
  const path = state.currentPath
  if (path === "/login") return renderLoginPage(state)
  if (path === "/register") return renderRegisterPage(state)
  if (path === "/settings") return renderSettingsPage(state)
  if (path === "/editor" || path.startsWith("/editor/")) return renderEditorPage(state)
  if (path.startsWith("/article/")) return renderArticlePage(state)
  if (path.startsWith("/@")) return renderProfilePage(state)
  return renderHomePage(state)
}

const renderApp = (state: AppState): VNode =>
  h(
    "div",
    { id: "root" },
    renderNav(state.user, state.currentPath),
    renderPage(state),
    renderFooter(),
  )

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = Effect.gen(function* () {
  const scope = yield* Effect.scope
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
      yield* Effect.gen(function* () {
        const data = yield* apiGet(client, "/api/user", saved, SingleUserResponse)
        yield* Queue.offer(actions, { type: "user-loaded", user: data.user })
      }).pipe(
        Effect.catchAll(() => Effect.sync(() => localStorage.removeItem("conduit-token"))),
        Effect.asVoid,
        Effect.forkIn(scope),
      )
    }
  })

  // Listen to route changes
  yield* Stream.runForEach(router.location$, (loc) =>
    Queue.offer(actions, { type: "route-changed", path: loc.path }),
  ).pipe(Effect.forkIn(scope))

  // Event delegation on the persistent root. Native listeners push typed
  // Actions into the Queue. Tachys-rendered DOM bubbles events identically
  // to real DOM, so this works unchanged from the morphdom variant.
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

  // Render pipeline: initial tick + action stream -> state -> VNode tree
  const vdom$: Stream.Stream<VNode> = Stream.concat(
    Stream.make(undefined as undefined),
    Stream.fromQueue(actions).pipe(
      Stream.tap((action) => handleAction(action, refs, client, actions, routerSink, scope)),
    ),
  ).pipe(
    Stream.mapEffect(() => readState(refs)),
    Stream.map(renderApp),
  )

  yield* sink.render(vdom$)
  yield* Effect.never
}).pipe(Effect.scoped)

export default app
