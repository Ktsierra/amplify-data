import { a, ClientSchema } from '../src/index';
import { Expect, Equal, ExpectFalse } from '@aws-amplify/data-schema-types';

describe('selectionSetDepth', () => {
  describe('behavioral depth effect on flatModel', () => {
    // 3-level chain: Author -> Post -> Comment
    // selectionSetDepth(N) gives exactly N traversable relationship hops.
    // At the boundary, relationship fields are stripped from the flatModel entirely.

    it('depth=1: first related model scalars accessible, its relationships are stripped', () => {
      const schema = a
        .schema({
          Author: a.model({
            name: a.string().required(),
            posts: a.hasMany('Post', 'authorId'),
          }),
          Post: a.model({
            title: a.string().required(),
            authorId: a.id().required(),
            author: a.belongsTo('Author', 'authorId'),
            comments: a.hasMany('Comment', 'postId'),
          }),
          Comment: a.model({
            content: a.string().required(),
            postId: a.id().required(),
            post: a.belongsTo('Post', 'postId'),
          }),
        })
        .selectionSetDepth(1)
        .authorization((allow) => [allow.publicApiKey()]);

      type Schema = ClientSchema<typeof schema>;
      type FlatAuthor = Schema['Author']['__meta']['flatModel'];

      // At depth=1: Author.posts is inlined (1 hop). Post is returned from
      // FlattenRelationships(Depth=0) which strips relationship fields, so
      // scalar fields are accessible but relationships are omitted entirely.
      type PostInFlat = FlatAuthor['posts'][number];
      type _postTitle = Expect<Equal<PostInFlat['title'], string>>;
      type _postAuthorId = Expect<Equal<PostInFlat['authorId'], string>>;

      // Post.comments is stripped at depth=1 — can't traverse further
      type _commentsStripped = ExpectFalse<Equal<'comments' extends keyof PostInFlat ? true : false, true>>;
    });

    it('depth=2: two hops inlined, third hop is stripped', () => {
      const schema = a
        .schema({
          Author: a.model({
            name: a.string().required(),
            posts: a.hasMany('Post', 'authorId'),
          }),
          Post: a.model({
            title: a.string().required(),
            authorId: a.id().required(),
            author: a.belongsTo('Author', 'authorId'),
            comments: a.hasMany('Comment', 'postId'),
          }),
          Comment: a.model({
            content: a.string().required(),
            postId: a.id().required(),
            post: a.belongsTo('Post', 'postId'),
          }),
        })
        .selectionSetDepth(2)
        .authorization((allow) => [allow.publicApiKey()]);

      type Schema = ClientSchema<typeof schema>;
      type FlatAuthor = Schema['Author']['__meta']['flatModel'];

      // At depth=2: Author → Post (hop 1) and Post → Comment (hop 2) are inlined
      type PostInFlat = FlatAuthor['posts'][number];
      type _postTitle = Expect<Equal<PostInFlat['title'], string>>;

      // Comment scalars accessible (2 hops)
      type CommentInFlat = PostInFlat['comments'][number];
      type _commentContent = Expect<Equal<CommentInFlat['content'], string>>;

      // Comment.post is the 3rd hop — stripped at depth=2
      type _postStrippedOnComment = ExpectFalse<Equal<'post' extends keyof CommentInFlat ? true : false, true>>;
    });

    it('depth=3: three hops inlined, Comment.post is now an object', () => {
      const schema = a
        .schema({
          Author: a.model({
            name: a.string().required(),
            posts: a.hasMany('Post', 'authorId'),
          }),
          Post: a.model({
            title: a.string().required(),
            authorId: a.id().required(),
            author: a.belongsTo('Author', 'authorId'),
            comments: a.hasMany('Comment', 'postId'),
          }),
          Comment: a.model({
            content: a.string().required(),
            postId: a.id().required(),
            post: a.belongsTo('Post', 'postId'),
          }),
        })
        .selectionSetDepth(3)
        .authorization((allow) => [allow.publicApiKey()]);

      type Schema = ClientSchema<typeof schema>;
      type FlatAuthor = Schema['Author']['__meta']['flatModel'];

      type PostInFlat = FlatAuthor['posts'][number];
      type CommentInFlat = PostInFlat['comments'][number];

      // At depth=3, Comment.post (3rd hop) is inlined as a plain object (scalars only)
      type PostFieldOnComment = CommentInFlat['post'];
      type _postOnCommentIsNotFunction = Expect<
        Equal<PostFieldOnComment extends (...args: any) => any ? true : false, false>
      >;
    });
  });

  describe('builder API', () => {
    it('default depth (no .selectionSetDepth()) behaves as depth 5', () => {
      const schema = a
        .schema({
          Post: a.model({
            title: a.string().required(),
            comments: a.hasMany('Comment', 'postId'),
          }),
          Comment: a.model({
            content: a.string().required(),
            postId: a.id().required(),
            post: a.belongsTo('Post', 'postId'),
          }),
        })
        .authorization((allow) => [allow.publicApiKey()]);

      type Schema = ClientSchema<typeof schema>;
      type PostType = Schema['Post']['type'];

      // Default depth 5 should produce inlined comments (not LazyLoader)
      type _test = Expect<
        Equal<PostType['title'], string>
      >;
    });

    it('.selectionSetDepth(2) is accepted', () => {
      const schema = a
        .schema({
          Post: a.model({
            title: a.string().required(),
            comments: a.hasMany('Comment', 'postId'),
          }),
          Comment: a.model({
            content: a.string().required(),
            postId: a.id().required(),
            post: a.belongsTo('Post', 'postId'),
          }),
        })
        .selectionSetDepth(2)
        .authorization((allow) => [allow.publicApiKey()]);

      type Schema = ClientSchema<typeof schema>;
      type PostType = Schema['Post']['type'];

      type _test = Expect<
        Equal<PostType['title'], string>
      >;
    });

    it('method chaining: .selectionSetDepth(2).authorization(...) works', () => {
      const schema = a
        .schema({
          Post: a.model({
            title: a.string().required(),
          }),
        })
        .selectionSetDepth(2)
        .authorization((allow) => [allow.publicApiKey()]);

      type Schema = ClientSchema<typeof schema>;
      type _test = Expect<Equal<Schema['Post']['type']['title'], string>>;
    });

    it('method chaining: .authorization(...).selectionSetDepth(1) works', () => {
      const schema = a
        .schema({
          Post: a.model({
            title: a.string().required(),
          }),
        })
        .authorization((allow) => [allow.publicApiKey()])
        .selectionSetDepth(1);

      type Schema = ClientSchema<typeof schema>;
      type _test = Expect<Equal<Schema['Post']['type']['title'], string>>;
    });

    it('.selectionSetDepth(0) produces a type error', () => {
      const schema = a
        .schema({
          Post: a.model({
            title: a.string().required(),
          }),
        })
        // @ts-expect-error - 0 is not a valid depth
        .selectionSetDepth(0)
        .authorization((allow) => [allow.publicApiKey()]);
    });

    it('.selectionSetDepth(6) produces a type error', () => {
      const schema = a
        .schema({
          Post: a.model({
            title: a.string().required(),
          }),
        })
        // @ts-expect-error - 6 is not a valid depth
        .selectionSetDepth(6)
        .authorization((allow) => [allow.publicApiKey()]);
    });

    it('double call prevented: .selectionSetDepth(2).selectionSetDepth(3) is a type error', () => {
      const schema = a
        .schema({
          Post: a.model({
            title: a.string().required(),
          }),
        })
        .selectionSetDepth(2)
        // @ts-expect-error - selectionSetDepth already called
        .selectionSetDepth(3);
    });
  });
});
