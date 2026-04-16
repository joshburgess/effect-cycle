/**
 * In-memory store for the RealWorld API.
 *
 * Uses Effect Refs for thread-safe mutable state. All data lives in memory
 * and is lost when the process exits.
 */
import { Context, Effect, Layer, Ref } from "effect"
import type { StoredArticle, StoredComment, StoredUser } from "./Domain.js"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface StoreShape {
  readonly users: Ref.Ref<ReadonlyArray<StoredUser>>
  readonly articles: Ref.Ref<ReadonlyArray<StoredArticle>>
  readonly comments: Ref.Ref<ReadonlyArray<StoredComment>>
  readonly tags: Ref.Ref<ReadonlyArray<string>>
  readonly follows: Ref.Ref<ReadonlySet<string>> // "followerId:followedId"
  readonly favorites: Ref.Ref<ReadonlySet<string>> // "userId:articleId"
  readonly nextUserId: Ref.Ref<number>
  readonly nextArticleId: Ref.Ref<number>
  readonly nextCommentId: Ref.Ref<number>
}

export class Store extends Context.Tag("effect-cycle/realworld/Store")<Store, StoreShape>() {}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

export const StoreLive: Layer.Layer<Store> = Layer.effect(
  Store,
  Effect.gen(function* () {
    const users = yield* Ref.make<ReadonlyArray<StoredUser>>([])
    const articles = yield* Ref.make<ReadonlyArray<StoredArticle>>([])
    const comments = yield* Ref.make<ReadonlyArray<StoredComment>>([])
    const tags = yield* Ref.make<ReadonlyArray<string>>([])
    const follows = yield* Ref.make<ReadonlySet<string>>(new Set())
    const favorites = yield* Ref.make<ReadonlySet<string>>(new Set())
    const nextUserId = yield* Ref.make(1)
    const nextArticleId = yield* Ref.make(1)
    const nextCommentId = yield* Ref.make(1)
    return {
      users,
      articles,
      comments,
      tags,
      follows,
      favorites,
      nextUserId,
      nextArticleId,
      nextCommentId,
    }
  }),
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const followKey = (followerId: number, followedId: number): string =>
  `${followerId}:${followedId}`

export const favoriteKey = (userId: number, articleId: number): string => `${userId}:${articleId}`
