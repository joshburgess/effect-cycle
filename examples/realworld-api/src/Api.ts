import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup } from "@effect/platform"
/**
 * RealWorld API definition using @effect/platform's HttpApi.
 *
 * Declares all 19 endpoints with typed request/response schemas. The
 * implementation lives in Handlers.ts.
 */
import { Schema } from "effect"
import { AuthMiddleware } from "./Auth.js"
import {
  CreateArticlePayload,
  CreateCommentPayload,
  LoginPayload,
  MultipleArticlesResponse,
  MultipleCommentsResponse,
  ProfileResponse,
  RegisterPayload,
  SingleArticleResponse,
  SingleCommentResponse,
  TagsResponse,
  UpdateArticlePayload,
  UpdateUserPayload,
  UserResponse,
} from "./Domain.js"

// ---------------------------------------------------------------------------
// Users group: /api/users and /api/user
// ---------------------------------------------------------------------------

const login = HttpApiEndpoint.post("login", "/api/users/login")
  .addSuccess(UserResponse)
  .setPayload(LoginPayload)
  .addError(HttpApiError.Unauthorized, { status: 401 })

const register = HttpApiEndpoint.post("register", "/api/users")
  .addSuccess(UserResponse, { status: 201 })
  .setPayload(RegisterPayload)
  .addError(HttpApiError.Conflict, { status: 409 })

const getCurrentUser = HttpApiEndpoint.get("getCurrentUser", "/api/user")
  .addSuccess(UserResponse)
  .middleware(AuthMiddleware)

const updateUser = HttpApiEndpoint.put("updateUser", "/api/user")
  .addSuccess(UserResponse)
  .setPayload(UpdateUserPayload)
  .middleware(AuthMiddleware)

export const UsersGroup = HttpApiGroup.make("users")
  .add(login)
  .add(register)
  .add(getCurrentUser)
  .add(updateUser)

// ---------------------------------------------------------------------------
// Profiles group: /api/profiles/:username
// ---------------------------------------------------------------------------

const getProfile = HttpApiEndpoint.get("getProfile", "/api/profiles/:username")
  .addSuccess(ProfileResponse)
  .setPath(Schema.Struct({ username: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })

const followUser = HttpApiEndpoint.post("followUser", "/api/profiles/:username/follow")
  .addSuccess(ProfileResponse)
  .setPath(Schema.Struct({ username: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })
  .middleware(AuthMiddleware)

const unfollowUser = HttpApiEndpoint.del("unfollowUser", "/api/profiles/:username/follow")
  .addSuccess(ProfileResponse)
  .setPath(Schema.Struct({ username: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })
  .middleware(AuthMiddleware)

export const ProfilesGroup = HttpApiGroup.make("profiles")
  .add(getProfile)
  .add(followUser)
  .add(unfollowUser)

// ---------------------------------------------------------------------------
// Articles group: /api/articles
// ---------------------------------------------------------------------------

const listArticles = HttpApiEndpoint.get("listArticles", "/api/articles")
  .addSuccess(MultipleArticlesResponse)
  .setUrlParams(
    Schema.Struct({
      tag: Schema.optional(Schema.String),
      author: Schema.optional(Schema.String),
      favorited: Schema.optional(Schema.String),
      limit: Schema.optional(Schema.String),
      offset: Schema.optional(Schema.String),
    }),
  )

const feedArticles = HttpApiEndpoint.get("feedArticles", "/api/articles/feed")
  .addSuccess(MultipleArticlesResponse)
  .setUrlParams(
    Schema.Struct({
      limit: Schema.optional(Schema.String),
      offset: Schema.optional(Schema.String),
    }),
  )
  .middleware(AuthMiddleware)

const getArticle = HttpApiEndpoint.get("getArticle", "/api/articles/:slug")
  .addSuccess(SingleArticleResponse)
  .setPath(Schema.Struct({ slug: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })

const createArticle = HttpApiEndpoint.post("createArticle", "/api/articles")
  .addSuccess(SingleArticleResponse, { status: 201 })
  .setPayload(CreateArticlePayload)
  .middleware(AuthMiddleware)

const updateArticle = HttpApiEndpoint.put("updateArticle", "/api/articles/:slug")
  .addSuccess(SingleArticleResponse)
  .setPath(Schema.Struct({ slug: Schema.String }))
  .setPayload(UpdateArticlePayload)
  .addError(HttpApiError.NotFound, { status: 404 })
  .addError(HttpApiError.Forbidden, { status: 403 })
  .middleware(AuthMiddleware)

const deleteArticle = HttpApiEndpoint.del("deleteArticle", "/api/articles/:slug")
  .setPath(Schema.Struct({ slug: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })
  .addError(HttpApiError.Forbidden, { status: 403 })
  .middleware(AuthMiddleware)

export const ArticlesGroup = HttpApiGroup.make("articles")
  .add(listArticles)
  .add(feedArticles)
  .add(getArticle)
  .add(createArticle)
  .add(updateArticle)
  .add(deleteArticle)

// ---------------------------------------------------------------------------
// Comments group: /api/articles/:slug/comments
// ---------------------------------------------------------------------------

const getComments = HttpApiEndpoint.get("getComments", "/api/articles/:slug/comments")
  .addSuccess(MultipleCommentsResponse)
  .setPath(Schema.Struct({ slug: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })

const addComment = HttpApiEndpoint.post("addComment", "/api/articles/:slug/comments")
  .addSuccess(SingleCommentResponse, { status: 201 })
  .setPath(Schema.Struct({ slug: Schema.String }))
  .setPayload(CreateCommentPayload)
  .addError(HttpApiError.NotFound, { status: 404 })
  .middleware(AuthMiddleware)

const deleteComment = HttpApiEndpoint.del("deleteComment", "/api/articles/:slug/comments/:id")
  .setPath(Schema.Struct({ slug: Schema.String, id: Schema.NumberFromString }))
  .addError(HttpApiError.NotFound, { status: 404 })
  .addError(HttpApiError.Forbidden, { status: 403 })
  .middleware(AuthMiddleware)

export const CommentsGroup = HttpApiGroup.make("comments")
  .add(getComments)
  .add(addComment)
  .add(deleteComment)

// ---------------------------------------------------------------------------
// Favorites group: /api/articles/:slug/favorite
// ---------------------------------------------------------------------------

const favoriteArticle = HttpApiEndpoint.post("favoriteArticle", "/api/articles/:slug/favorite")
  .addSuccess(SingleArticleResponse)
  .setPath(Schema.Struct({ slug: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })
  .middleware(AuthMiddleware)

const unfavoriteArticle = HttpApiEndpoint.del("unfavoriteArticle", "/api/articles/:slug/favorite")
  .addSuccess(SingleArticleResponse)
  .setPath(Schema.Struct({ slug: Schema.String }))
  .addError(HttpApiError.NotFound, { status: 404 })
  .middleware(AuthMiddleware)

export const FavoritesGroup = HttpApiGroup.make("favorites")
  .add(favoriteArticle)
  .add(unfavoriteArticle)

// ---------------------------------------------------------------------------
// Tags group: /api/tags
// ---------------------------------------------------------------------------

const getTags = HttpApiEndpoint.get("getTags", "/api/tags").addSuccess(TagsResponse)

export const TagsGroup = HttpApiGroup.make("tags").add(getTags)

// ---------------------------------------------------------------------------
// Top-level API
// ---------------------------------------------------------------------------

export class RealWorldApi extends HttpApi.make("realworld")
  .add(UsersGroup)
  .add(ProfilesGroup)
  .add(ArticlesGroup)
  .add(CommentsGroup)
  .add(FavoritesGroup)
  .add(TagsGroup) {}
