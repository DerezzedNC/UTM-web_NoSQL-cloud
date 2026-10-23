import { Field, inputClass } from "@/components/ui/Field";
import type { DetalleAcademico as DetalleAcademicoValue } from "@/lib/incidencias/types";

type DetalleAcademicoProps = {
  value: DetalleAcademicoValue;
  errors: Record<string, string>;
  onChange: (value: DetalleAcademicoValue) => void;
};

export function DetalleAcademico({
  value,
  errors,
  onChange,
}: DetalleAcademicoProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="plataforma"
        label="Plataforma"
        error={errors["detalle_especifico.plataforma"]}
      >
        <input
          id="plataforma"
          value={value.plataforma}
          onChange={(event) =>
            onChange({ ...value, plataforma: event.target.value })
          }
          placeholder="Moodle, Teams, SIA…"
          className={inputClass(
            Boolean(errors["detalle_especifico.plataforma"]),
          )}
        />
      </Field>
      <Field
        id="codigo_curso"
        label="Código de curso"
        error={errors["detalle_especifico.codigo_curso"]}
      >
        <input
          id="codigo_curso"
          value={value.codigo_curso}
          onChange={(event) =>
            onChange({ ...value, codigo_curso: event.target.value })
          }
          placeholder="ISC-401"
          className={inputClass(
            Boolean(errors["detalle_especifico.codigo_curso"]),
          )}
        />
      </Field>
      <Field
        id="periodo_escolar"
        label="Periodo escolar"
        error={errors["detalle_especifico.periodo_escolar"]}
      >
        <input
          id="periodo_escolar"
          value={value.periodo_escolar}
          onChange={(event) =>
            onChange({ ...value, periodo_escolar: event.target.value })
          }
          placeholder="2026-A"
          className={inputClass(
            Boolean(errors["detalle_especifico.periodo_escolar"]),
          )}
        />
      </Field>
      <Field
        id="estudiantes_impactados"
        label="Estudiantes impactados"
        error={errors["detalle_especifico.estudiantes_impactados"]}
      >
        <input
          id="estudiantes_impactados"
          type="number"
          min={0}
          value={value.estudiantes_impactados}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange({
              ...value,
              estudiantes_impactados: Number.isFinite(parsed) ? parsed : 0,
            });
          }}
          className={inputClass(
            Boolean(errors["detalle_especifico.estudiantes_impactados"]),
          )}
        />
      </Field>
    </div>
  );
}
