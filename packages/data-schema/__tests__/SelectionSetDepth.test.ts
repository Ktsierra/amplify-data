import { expectTypeTestsToPassAsync } from 'jest-tsd';
import { a } from '../src/index';
import { configure } from '../src/ModelSchema';

// evaluates type defs in corresponding test-d.ts file
it('should not produce static type errors', async () => {
  await expectTypeTestsToPassAsync(__filename);
});

it('selectionSetDepth defaults to 5 at runtime', () => {
  const schema = a
    .schema({
      Post: a.model({
        title: a.string().required(),
      }),
    })
    .authorization((allow) => [allow.publicApiKey()]);

  expect((schema.data as any).selectionSetDepth).toBe(5);
});

it('selectionSetDepth can be set at runtime', () => {
  const schema = a
    .schema({
      Post: a.model({
        title: a.string().required(),
      }),
    })
    .selectionSetDepth(2)
    .authorization((allow) => [allow.publicApiKey()]);

  expect((schema.data as any).selectionSetDepth).toBe(2);
});

it('selectionSetDepth can be set after authorization', () => {
  const schema = a
    .schema({
      Post: a.model({
        title: a.string().required(),
      }),
    })
    .authorization((allow) => [allow.publicApiKey()])
    .selectionSetDepth(1);

  expect((schema.data as any).selectionSetDepth).toBe(1);
});

it('selectionSetDepth can be set on RDS schemas', () => {
  const schema = configure({
    database: {
      engine: 'mysql',
      connectionUri: 'fake' as any,
    },
  })
    .schema({
      Post: a.model({
        title: a.string().required(),
      }),
    })
    .selectionSetDepth(2);

  expect((schema.data as any).selectionSetDepth).toBe(2);
});
