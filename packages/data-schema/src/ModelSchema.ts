import type {
  DerivedApiDefinition,
  SetTypeSubArg,
  SchemaConfiguration,
  DataSourceConfiguration,
  DatasourceEngine,
  UnionToIntersection,
} from '@aws-amplify/data-schema-types';
import {
  type InternalModel,
  isSchemaModelType,
  SchemaModelType,
  AddRelationshipFieldsToModelTypeFields,
  type BaseModelType,
} from './ModelType';
import type { EnumType } from './EnumType';
import type { CustomType, CustomTypeParamShape } from './CustomType';
import type {
  CustomOperation,
  CustomOperationParamShape,
  InternalCustom,
  MutationCustomOperation,
  QueryCustomOperation,
  SubscriptionCustomOperation,
} from './CustomOperation';
import { processSchema } from './SchemaProcessor';
import { AllowModifier, SchemaAuthorization, allow } from './Authorization';
import { Brand, brand, getBrand, RenameUsingTuples } from './util';
import {
  ModelRelationshipField,
  ModelRelationshipFieldParamShape,
} from './ModelRelationshipField';
import { ConversationType } from './ai/ConversationType';

export { ModelType } from './ModelType';
export { EnumType } from './EnumType';
export { CustomType } from './CustomType';
export { CustomOperation } from './CustomOperation';
export { ConversationType } from './ai/ConversationType';

export const rdsSchemaBrandName = 'RDSSchema';
export const rdsSchemaBrand = brand(rdsSchemaBrandName);
export type RDSSchemaBrand = Brand<typeof rdsSchemaBrandName>;

export const ddbSchemaBrandName = 'DDBSchema';
const ddbSchemaBrand = brand(ddbSchemaBrandName);
export type DDBSchemaBrand = Brand<typeof ddbSchemaBrandName>;

type SchemaContent =
  | BaseModelType
  | CustomType<CustomTypeParamShape>
  | EnumType
  | CustomOperation<CustomOperationParamShape, any>
  | ConversationType;

// The SQL-only `addToSchema` accepts all top-level entities, excepts models
type AddToSchemaContent = Exclude<SchemaContent, BaseModelType>;
type AddToSchemaContents = Record<string, AddToSchemaContent>;

type NonEmpty<T> = keyof T extends never ? never : T;

export type ModelSchemaContents = Record<string, SchemaContent>;

type InternalSchemaModels = Record<
  string,
  InternalModel | EnumType | CustomType<any> | InternalCustom
>;

export type SelectionSetDepthValue = 1 | 2 | 3 | 4 | 5;

export type ModelSchemaParamShape = {
  types: ModelSchemaContents;
  authorization: SchemaAuthorization<any, any, any>[];
  configuration: SchemaConfiguration<any, any>;
};

export type RDSModelSchemaParamShape = ModelSchemaParamShape;

export const DEFAULT_SELECTION_SET_DEPTH: SelectionSetDepthValue = 5;

export type InternalSchema = {
  data: {
    types: InternalSchemaModels;
    authorization: SchemaAuthorization<any, any, any>[];
    configuration: SchemaConfiguration<any, any>;
  };
  context?: {
    schemas: InternalSchema[];
  };
};

export type BaseSchema<
  T extends ModelSchemaParamShape,
  IsRDS extends boolean = false,
> = {
  data: T;
  models: {
    [TypeKey in keyof T['types']]: T['types'][TypeKey] extends BaseModelType
      ? SchemaModelType<T['types'][TypeKey], TypeKey & string, IsRDS>
      : never;
  };
  transform: () => DerivedApiDefinition;
  context?: {
    schemas: GenericModelSchema<any>[];
  };
};

export type GenericModelSchema<T extends ModelSchemaParamShape> =
  BaseSchema<T> & Brand<typeof rdsSchemaBrandName | typeof ddbSchemaBrandName>;

/**
 * Model schema definition interface
 *
 * @param T - The shape of the model schema
 * @param UsedMethods - The method keys already defined
 * @param Depth - Selection set depth; carried as a separate generic param (rather than
 *   inside T via SetTypeSubArg) to avoid nested mapped-type overhead that breaks
 *   eslint's type resolver on large schemas
 */
export type ModelSchema<
  T extends ModelSchemaParamShape,
  UsedMethods extends 'authorization' | 'relationships' | 'selectionSetDepth' = never,
  Depth extends SelectionSetDepthValue = 5,
> = Omit<
  {
    authorization: <AuthRules extends SchemaAuthorization<any, any, any>>(
      callback: (allow: AllowModifier) => AuthRules | AuthRules[],
    ) => ModelSchema<
      SetTypeSubArg<T, 'authorization', AuthRules[]>,
      UsedMethods | 'authorization',
      Depth
    >;
    /**
     * Controls how many relationship hops are inlined in the flatModel used
     * for custom selection set type generation. `selectionSetDepth(N)` allows
     * selection set paths up to N relationship edges deep.
     *
     * @param depth - 1–5 (default 5). Lower values reduce TS instantiations
     * and prevent TS2590 on dense bidirectional schemas, at the cost of
     * shallower nested selection set types.
     */
    selectionSetDepth: <D extends SelectionSetDepthValue>(
      depth: D,
    ) => ModelSchema<T, UsedMethods | 'selectionSetDepth', D>;
  },
  UsedMethods
> &
  BaseSchema<T> &
  { data: { selectionSetDepth: Depth } } &
  DDBSchemaBrand;

type RDSModelSchemaFunctions =
  | 'addToSchema'
  | 'addQueries'
  | 'addMutations'
  | 'addSubscriptions'
  | 'authorization'
  | 'selectionSetDepth'
  | 'setRelationships'
  | 'setAuthorization'
  | 'renameModelFields'
  | 'renameModels';

type OmitFromEach<Models, Modifier extends string> = {
  [ModelName in keyof Models]: Omit<Models[ModelName], Modifier>;
};

type RelationshipTemplate = Record<
  string,
  ModelRelationshipField<ModelRelationshipFieldParamShape, string, any, any>
>;

/**
 * RDSModel schema definition interface
 *
 * @param T - The shape of the RDS model schema
 * @param UsedMethods - The method keys already defined
 * @param Depth - Selection set depth (see {@link ModelSchema} for details)
 */
export type RDSModelSchema<
  T extends RDSModelSchemaParamShape,
  UsedMethods extends RDSModelSchemaFunctions = never,
  Depth extends SelectionSetDepthValue = 5,
> = Omit<
  {
    addToSchema: <AddedTypes extends AddToSchemaContents>(
      types: AddedTypes,
    ) => RDSModelSchema<
      SetTypeSubArg<T, 'types', T['types'] & AddedTypes>,
      UsedMethods | 'addToSchema',
      Depth
    >;
    /**
     * @deprecated use `addToSchema()` to add operations to a SQL schema
     */
    addQueries: <Queries extends Record<string, QueryCustomOperation>>(
      types: Queries,
    ) => RDSModelSchema<
      SetTypeSubArg<T, 'types', T['types'] & Queries>,
      UsedMethods | 'addQueries',
      Depth
    >;
    /**
     * @deprecated use `addToSchema()` to add operations to a SQL schema
     */
    addMutations: <Mutations extends Record<string, MutationCustomOperation>>(
      types: Mutations,
    ) => RDSModelSchema<
      SetTypeSubArg<T, 'types', T['types'] & Mutations>,
      UsedMethods | 'addMutations',
      Depth
    >;
    /**
     * @deprecated use `addToSchema()` to add operations to a SQL schema
     */
    addSubscriptions: <
      Subscriptions extends Record<string, SubscriptionCustomOperation>,
    >(
      types: Subscriptions,
    ) => RDSModelSchema<
      SetTypeSubArg<T, 'types', T['types'] & Subscriptions>,
      UsedMethods | 'addSubscriptions',
      Depth
    >;
    // TODO: hide this, since SQL schema auth is configured via .setAuthorization?
    authorization: <AuthRules extends SchemaAuthorization<any, any, any>>(
      callback: (allow: AllowModifier) => AuthRules | AuthRules[],
    ) => RDSModelSchema<
      SetTypeSubArg<T, 'authorization', AuthRules[]>,
      UsedMethods | 'authorization',
      Depth
    >;
    /**
     * Controls how many relationship hops are inlined in the flatModel used
     * for custom selection set type generation. `selectionSetDepth(N)` allows
     * selection set paths up to N relationship edges deep.
     *
     * @param depth - 1–5 (default 5). Lower values reduce TS instantiations
     * and prevent TS2590 on dense bidirectional schemas, at the cost of
     * shallower nested selection set types.
     */
    selectionSetDepth: <D extends SelectionSetDepthValue>(
      depth: D,
    ) => RDSModelSchema<T, UsedMethods | 'selectionSetDepth', D>;
    setAuthorization: (
      callback: (
        models: OmitFromEach<BaseSchema<T, true>['models'], 'secondaryIndexes'>,
        schema: RDSModelSchema<T, UsedMethods | 'setAuthorization', Depth>,
      ) => void,
    ) => RDSModelSchema<T, never, Depth>;
    setRelationships: <
      Relationships extends ReadonlyArray<
        Partial<Record<keyof T['types'], RelationshipTemplate>>
      >,
    >(
      callback: (
        models: OmitFromEach<
          BaseSchema<T, true>['models'],
          'authorization' | 'fields' | 'secondaryIndexes'
        >,
      ) => Relationships,
    ) => RDSModelSchema<
      SetTypeSubArg<
        T,
        'types',
        {
          [ModelName in keyof T['types']]: ModelWithRelationships<
            T['types'],
            Relationships,
            ModelName
          >;
        }
      >,
      UsedMethods | 'setRelationships',
      Depth
    >;
    renameModels: <
      NewName extends string,
      CurName extends string = keyof BaseSchema<T>['models'] & string,
      const ChangeLog extends readonly [CurName, NewName][] = [],
    >(
      callback: () => ChangeLog,
    ) => RDSModelSchema<
      SetTypeSubArg<T, 'types', RenameUsingTuples<T['types'], ChangeLog>>,
      UsedMethods | 'renameModels',
      Depth
    >;
  },
  UsedMethods
> &
  BaseSchema<T, true> &
  { data: { selectionSetDepth: Depth } } &
  RDSSchemaBrand;

/**
 * Amplify API Next Model Schema shape
 */
export type ModelSchemaType = ModelSchema<ModelSchemaParamShape>;

type ModelWithRelationships<
  Types extends Record<string, any>,
  Relationships extends ReadonlyArray<
    Record<string, RelationshipTemplate | undefined>
  >,
  ModelName extends keyof Types,
  RelationshipMap extends UnionToIntersection<
    Relationships[number]
  > = UnionToIntersection<Relationships[number]>,
> = ModelName extends keyof RelationshipMap
  ? RelationshipMap[ModelName] extends Record<
      string,
      ModelRelationshipField<ModelRelationshipFieldParamShape, string, any, any>
    >
    ? AddRelationshipFieldsToModelTypeFields<
        Types[ModelName],
        RelationshipMap[ModelName]
      >
    : Types[ModelName]
  : Types[ModelName];

/**
 * Filter the schema types down to only include the ModelTypes as SchemaModelType
 *
 * @param schemaContents The object containing all SchemaContent for this schema
 * @returns Only the schemaContents that are ModelTypes, coerced to the SchemaModelType surface
 */
const filterSchemaModelTypes = (
  schemaContents: ModelSchemaContents,
): Record<string, SchemaModelType> => {
  const modelTypes: Record<string, SchemaModelType> = {};

  if (schemaContents) {
    Object.entries(schemaContents).forEach(([key, content]) => {
      if (isSchemaModelType(content)) {
        modelTypes[key] = content;
      }
    });
  }

  return modelTypes;
};

/**
 * Model Schema type guard
 * @param schema - api-next ModelSchema or string
 * @returns true if the given value is a ModelSchema
 */
export const isModelSchema = (
  schema: string | ModelSchemaType,
): schema is ModelSchemaType => {
  return typeof schema === 'object' && schema.data !== undefined;
};

/**
 * Ensures that only supported entities are being added to the SQL schema through `addToSchema`
 * Models are not supported for brownfield SQL
 *
 * @param types - purposely widened to ModelSchemaContents, because we need to validate at runtime that a model is not being passed in here
 */
function validateAddToSchema(types: ModelSchemaContents): void {
  for (const [name, type] of Object.entries(types)) {
    if (getBrand(type) === 'modelType') {
      throw new Error(
        `Invalid value specified for ${name} in addToSchema(). Models cannot be manually added to a SQL schema.`,
      );
    }
  }
}

function _rdsSchema<
  T extends RDSModelSchemaParamShape,
  DSC extends SchemaConfiguration<any, any>,
>(types: T['types'], config: DSC): RDSModelSchema<T> {
  const data: RDSModelSchemaParamShape & {
    selectionSetDepth: SelectionSetDepthValue;
  } = {
    types,
    authorization: [],
    configuration: config,
    selectionSetDepth: DEFAULT_SELECTION_SET_DEPTH,
  };
  const models = filterSchemaModelTypes(data.types) as any;
  return {
    data,
    models,
    transform(): DerivedApiDefinition {
      const internalSchema: InternalSchema = {
        data,
        context: this.context,
      } as InternalSchema;

      return processSchema({ schema: internalSchema });
    },
    authorization(callback): any {
      const rules = callback(allow);
      this.data.authorization = Array.isArray(rules) ? rules : [rules];
      const { authorization: _, ...rest } = this;
      return rest;
    },
    // Value is only consumed via Metadata['selectionSetDepth'] during type resolution, not read at runtime.
    selectionSetDepth(depth): any {
      (this.data as any).selectionSetDepth = depth;
      const { selectionSetDepth: _, ...rest } = this;
      return rest;
    },
    addToSchema(types: AddToSchemaContents): any {
      validateAddToSchema(types);
      this.data.types = { ...this.data.types, ...types };
      const { addToSchema: _, ...rest } = this;
      return rest;
    },
    addQueries(types: Record<string, QueryCustomOperation>): any {
      this.data.types = { ...this.data.types, ...types };
      const { addQueries: _, ...rest } = this;
      return rest;
    },
    addMutations(types: Record<string, MutationCustomOperation>): any {
      this.data.types = { ...this.data.types, ...types };
      const { addMutations: _, ...rest } = this;
      return rest;
    },
    addSubscriptions(types: Record<string, SubscriptionCustomOperation>): any {
      this.data.types = { ...this.data.types, ...types };
      const { addSubscriptions: _, ...rest } = this;
      return rest;
    },
    setAuthorization(callback) {
      callback(models, this);
      const { setAuthorization: _, ...rest } = this;
      return rest;
    },
    setRelationships(callback): any {
      const { setRelationships: _, ...rest } = this;
      // The relationships are added via `models.<Model>.relationships`
      // modifiers that's being called within the callback. They are modifying
      // by references on each model, so there is not anything else to be done
      // here.
      callback(models);
      return rest;
    },
    renameModels(callback): any {
      const { renameModels: _, ...rest } = this;
      // returns an array of tuples [curName, newName]
      const changeLog = callback();

      changeLog.forEach(([curName, newName]) => {
        const currentType = data.types[curName];

        if (currentType === undefined) {
          throw new Error(
            `Invalid renameModels call. ${curName} is not defined in the schema`,
          );
        }

        if (typeof newName !== 'string' || newName.length < 1) {
          throw new Error(
            `Invalid renameModels call. New name must be a non-empty string. Received: "${newName}"`,
          );
        }

        models[newName] = currentType;
        data.types[newName] = currentType;
        models[newName].data.originalName = curName;

        delete models[curName];
        delete data.types[curName];
      });

      return rest;
    },
    ...rdsSchemaBrand,
  } as RDSModelSchema<T>;
}

function _ddbSchema<
  T extends ModelSchemaParamShape,
  DSC extends SchemaConfiguration<any, any>,
>(types: T['types'], config: DSC): ModelSchema<T> {
  const data: ModelSchemaParamShape & { selectionSetDepth: 5 } = {
    types,
    authorization: [],
    configuration: config,
    selectionSetDepth: 5 as const,
  };
  return {
    data,
    transform(): DerivedApiDefinition {
      const internalSchema = {
        data,
        context: this.context,
      };

      return processSchema({ schema: internalSchema });
    },
    authorization(callback): any {
      const rules = callback(allow);
      this.data.authorization = Array.isArray(rules) ? rules : [rules];
      const { authorization: _, ...rest } = this;
      return rest;
    },
    // Value is only consumed via Metadata['selectionSetDepth'] during type resolution, not read at runtime.
    selectionSetDepth(depth): any {
      (this.data as any).selectionSetDepth = depth;
      const { selectionSetDepth: _, ...rest } = this;
      return rest;
    },
    models: filterSchemaModelTypes(data.types),
    ...ddbSchemaBrand,
  } satisfies ModelSchema<any> as never;
}

type SchemaReturnType<
  DE extends DatasourceEngine,
  Types extends ModelSchemaContents,
> = DE extends 'dynamodb'
  ? ModelSchema<{
      types: Types;
      authorization: [];
      configuration: any;
    }>
  : RDSModelSchema<{
      types: Types;
      authorization: [];
      configuration: any;
    }>;

function bindConfigToSchema<DE extends DatasourceEngine>(
  config: SchemaConfiguration<DE, DataSourceConfiguration<DE>>,
): <Types extends ModelSchemaContents>(
  types: NonEmpty<Types>,
) => SchemaReturnType<DE, Types> {
  return (types) => {
    return (
      config.database.engine === 'dynamodb'
        ? _ddbSchema(types, config)
        : _rdsSchema(types, config)
    ) as SchemaReturnType<DE, any>;
  };
}

/**
 * The API and data model definition for Amplify Data. Pass in `{ <NAME>: a.model(...) }` to create a database table
 * and exposes CRUDL operations via an API.
 * @param types The API and data model definition
 * @returns An API and data model definition to be deployed with Amplify (Gen 2) experience (`processSchema(...)`)
 * or with the Amplify Data CDK construct (`@aws-amplify/data-construct`)
 */
export const schema = bindConfigToSchema({ database: { engine: 'dynamodb' } });

/**
 * Configure wraps schema definition with non-default config to allow usecases other than
 * the default DynamoDB use-case.
 *
 * @param config The SchemaConfig augments the schema with content like the database type
 * @returns
 */
export function configure<DE extends DatasourceEngine>(
  config: SchemaConfiguration<DE, DataSourceConfiguration<DE>>,
): {
  schema: <Types extends ModelSchemaContents>(
    types: NonEmpty<Types>,
  ) => SchemaReturnType<DE, Types>;
} {
  return {
    schema: bindConfigToSchema(config),
  };
}

export function isCustomPathData(obj: any): obj is CustomPathData {
  return (
    'stack' in obj &&
    (typeof obj.stack === 'undefined' || typeof obj.stack === 'string') &&
    'entry' in obj &&
    typeof obj.entry === 'string'
  );
}

export type CustomPathData = {
  stack: string | undefined;
  entry: string;
};
