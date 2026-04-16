/**
 * Domain schemas for the RealWorld (Conduit) API.
 *
 * All request/response shapes are defined with Effect Schema so they can be
 * reused for validation, encoding, and OpenAPI generation.
 */
import { Schema } from "effect"

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const Email = Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
export const Slug = Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/))
export const NonBlank = Schema.String.pipe(Schema.minLength(1))

// ---------------------------------------------------------------------------
// Core entities (stored shapes)
// ---------------------------------------------------------------------------

export class StoredUser extends Schema.Class<StoredUser>("StoredUser")({
  id: Schema.Number,
  email: Schema.String,
  username: Schema.String,
  passwordHash: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
}) {}

export class StoredArticle extends Schema.Class<StoredArticle>("StoredArticle")({
  id: Schema.Number,
  slug: Schema.String,
  title: Schema.String,
  description: Schema.String,
  body: Schema.String,
  tagList: Schema.Array(Schema.String),
  authorId: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class StoredComment extends Schema.Class<StoredComment>("StoredComment")({
  id: Schema.Number,
  body: Schema.String,
  articleId: Schema.Number,
  authorId: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export class Profile extends Schema.Class<Profile>("Profile")({
  username: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  following: Schema.Boolean,
}) {}

export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  user: Schema.Struct({
    email: Schema.String,
    token: Schema.String,
    username: Schema.String,
    bio: Schema.NullOr(Schema.String),
    image: Schema.NullOr(Schema.String),
  }),
}) {}

export class ProfileResponse extends Schema.Class<ProfileResponse>("ProfileResponse")({
  profile: Profile,
}) {}

export class Author extends Schema.Class<Author>("Author")({
  username: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  following: Schema.Boolean,
}) {}

export class ArticleBody extends Schema.Class<ArticleBody>("ArticleBody")({
  slug: Schema.String,
  title: Schema.String,
  description: Schema.String,
  body: Schema.String,
  tagList: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  favorited: Schema.Boolean,
  favoritesCount: Schema.Number,
  author: Author,
}) {}

export class SingleArticleResponse extends Schema.Class<SingleArticleResponse>(
  "SingleArticleResponse",
)({
  article: ArticleBody,
}) {}

export class MultipleArticlesResponse extends Schema.Class<MultipleArticlesResponse>(
  "MultipleArticlesResponse",
)({
  articles: Schema.Array(ArticleBody),
  articlesCount: Schema.Number,
}) {}

export class CommentBody extends Schema.Class<CommentBody>("CommentBody")({
  id: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  body: Schema.String,
  author: Author,
}) {}

export class SingleCommentResponse extends Schema.Class<SingleCommentResponse>(
  "SingleCommentResponse",
)({
  comment: CommentBody,
}) {}

export class MultipleCommentsResponse extends Schema.Class<MultipleCommentsResponse>(
  "MultipleCommentsResponse",
)({
  comments: Schema.Array(CommentBody),
}) {}

export class TagsResponse extends Schema.Class<TagsResponse>("TagsResponse")({
  tags: Schema.Array(Schema.String),
}) {}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export class LoginPayload extends Schema.Class<LoginPayload>("LoginPayload")({
  user: Schema.Struct({
    email: Schema.String,
    password: Schema.String,
  }),
}) {}

export class RegisterPayload extends Schema.Class<RegisterPayload>("RegisterPayload")({
  user: Schema.Struct({
    username: Schema.String,
    email: Schema.String,
    password: Schema.String,
  }),
}) {}

export class UpdateUserPayload extends Schema.Class<UpdateUserPayload>("UpdateUserPayload")({
  user: Schema.Struct({
    email: Schema.optional(Schema.String),
    username: Schema.optional(Schema.String),
    password: Schema.optional(Schema.String),
    bio: Schema.optional(Schema.NullOr(Schema.String)),
    image: Schema.optional(Schema.NullOr(Schema.String)),
  }),
}) {}

export class CreateArticlePayload extends Schema.Class<CreateArticlePayload>(
  "CreateArticlePayload",
)({
  article: Schema.Struct({
    title: Schema.String,
    description: Schema.String,
    body: Schema.String,
    tagList: Schema.optional(Schema.Array(Schema.String)),
  }),
}) {}

export class UpdateArticlePayload extends Schema.Class<UpdateArticlePayload>(
  "UpdateArticlePayload",
)({
  article: Schema.Struct({
    title: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    body: Schema.optional(Schema.String),
  }),
}) {}

export class CreateCommentPayload extends Schema.Class<CreateCommentPayload>(
  "CreateCommentPayload",
)({
  comment: Schema.Struct({
    body: Schema.String,
  }),
}) {}
