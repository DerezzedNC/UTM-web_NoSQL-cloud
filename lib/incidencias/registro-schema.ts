import {
  incidenciaCampusSchema,
  type IncidenciaCampusPayload,
  detalleAcademicoSchema,
  detalleComputoRedesSchema,
  detalleInfraestructuraSchema,
  ubicacionSchema,
  reportanteSchema,
  camposUniversalesSchema,
} from "./schema";

export const registroIncidenciaSchema = incidenciaCampusSchema;
export type RegistroIncidenciaPayload = IncidenciaCampusPayload;

export {
  detalleAcademicoSchema,
  detalleComputoRedesSchema,
  detalleInfraestructuraSchema,
  ubicacionSchema,
  reportanteSchema,
  camposUniversalesSchema,
};
