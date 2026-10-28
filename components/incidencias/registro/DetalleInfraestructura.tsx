import { Field, inputClass } from "@/components/ui/Field";
import type { DetalleInfraestructura as DetalleInfraestructuraValue } from "@/lib/incidencias/types";

type DetalleInfraestructuraProps = {
  value: DetalleInfraestructuraValue;
  errors: Record<string, string>;
  onChange: (value: DetalleInfraestructuraValue) => void;
};

export function DetalleInfraestructura({
  value,
  errors,
  onChange,
}: DetalleInfraestructuraProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="tipo_dano"
        label="Tipo de daño"
        error={errors["detalle_especifico.tipo_dano"]}
      >
        <input
          id="tipo_dano"
          value={value.tipo_dano}
          onChange={(event) =>
            onChange({ ...value, tipo_dano: event.target.value })
          }
          placeholder="Fuga, cortocircuito, desprendimiento…"
          className={inputClass(Boolean(errors["detalle_especifico.tipo_dano"]))}
        />
      </Field>
      <Field
        id="riesgo_seguridad"
        label="Riesgo de seguridad"
        error={errors["detalle_especifico.riesgo_seguridad"]}
      >
        <select
          id="riesgo_seguridad"
          value={value.riesgo_seguridad}
          onChange={(event) =>
            onChange({
              ...value,
              riesgo_seguridad:
                event.target.value as DetalleInfraestructuraValue["riesgo_seguridad"],
            })
          }
          className={inputClass(
            Boolean(errors["detalle_especifico.riesgo_seguridad"]),
          )}
        >
          <option value="Bajo">Bajo</option>
          <option value="Medio">Medio</option>
          <option value="Alto">Alto</option>
          <option value="Crítico">Crítico</option>
        </select>
      </Field>
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={value.requiere_insumos}
          onChange={(event) =>
            onChange({
              ...value,
              requiere_insumos: event.target.checked,
            })
          }
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700"
        />
        <span>
          <span className="font-medium">Requiere insumos</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Marca si hay que solicitar material para atender el daño.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={value.contratista_externo}
          onChange={(event) =>
            onChange({ ...value, contratista_externo: event.target.checked })
          }
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700"
        />
        <span>
          <span className="font-medium">Contratista externo</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Indica si interviene un proveedor fuera del campus.
          </span>
        </span>
      </label>
    </div>
  );
}
