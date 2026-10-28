import { Field, inputClass } from "@/components/ui/Field";
import { PRIORIDAD_META } from "@/lib/incidencias/constants";
import {
  PRIORIDADES,
  type BorradorIncidencia,
  type Prioridad,
} from "@/lib/incidencias/types";

type CamposUniversalesProps = {
  value: BorradorIncidencia;
  errors: Record<string, string>;
  onChange: <K extends keyof BorradorIncidencia>(
    campo: K,
    valor: BorradorIncidencia[K],
  ) => void;
};

export function CamposUniversales({
  value,
  errors,
  onChange,
}: CamposUniversalesProps) {
  const caracteresTitulo = value.titulo.trim().length;

  return (
    <div className="grid gap-5">
      <Field
        id="titulo"
        label="Título"
        hint={`${caracteresTitulo}/150 · entre 10 y 150 caracteres`}
        error={errors.titulo}
      >
        <input
          id="titulo"
          value={value.titulo}
          maxLength={150}
          onChange={(event) => onChange("titulo", event.target.value)}
          placeholder="Falla de red en laboratorio de cómputo"
          className={inputClass(Boolean(errors.titulo))}
        />
      </Field>

      <Field
        id="descripcion"
        label="Descripción"
        hint="Mínimo 15 caracteres. Incluye síntoma, horario y alcance."
        error={errors.descripcion}
      >
        <textarea
          id="descripcion"
          rows={4}
          value={value.descripcion}
          onChange={(event) => onChange("descripcion", event.target.value)}
          placeholder="Describe qué ocurrió, desde cuándo y quiénes están afectados."
          className={`${inputClass(Boolean(errors.descripcion))} min-h-28 resize-y`}
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">
          Prioridad
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIORIDADES.map((prioridad) => (
            <label
              key={prioridad}
              data-selected={value.prioridad === prioridad}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold ring-2 ring-transparent transition ${PRIORIDAD_META[prioridad].clase}`}
            >
              <input
                type="radio"
                name="prioridad"
                value={prioridad}
                checked={value.prioridad === prioridad}
                onChange={() => onChange("prioridad", prioridad as Prioridad)}
                className="sr-only"
              />
              {PRIORIDAD_META[prioridad].etiqueta}
            </label>
          ))}
        </div>
        {errors.prioridad ? (
          <p className="mt-2 text-sm text-rose-700" role="alert">
            {errors.prioridad}
          </p>
        ) : null}
      </fieldset>

    </div>
  );
}
