import { ImpliedAuthFields } from '../../Authorization';
import { BaseSchema, SelectionSetDepthValue } from '../../ModelSchema';

export interface SchemaMetadata<Schema extends BaseSchema<any, any>> {
  authFields: AuthFields<Schema>;
  selectionSetDepth: ExtractSelectionSetDepth<Schema>;
}

type AuthFields<Schema extends Record<string, any>> =
  Schema['data']['authorization'][number] extends never
    ? object
    : ImpliedAuthFields<Schema['data']['authorization'][number]>;

type ExtractSelectionSetDepth<Schema extends Record<string, any>> =
  Schema['data']['selectionSetDepth'] extends SelectionSetDepthValue
    ? Schema['data']['selectionSetDepth']
    : 5;
