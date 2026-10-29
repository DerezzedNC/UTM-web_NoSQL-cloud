import { Field, inputClass } from "@/components/ui/Field";
import type { BorradorIncidencia } from "@/lib/incidencias/types";

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
    </div>
  );
}
