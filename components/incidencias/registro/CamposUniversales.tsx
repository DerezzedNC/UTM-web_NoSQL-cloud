import { Field, inputClass } from "@/components/ui/Field";
import { CATEGORIA_META, PRIORIDAD_META } from "@/lib/incidencias/constants";
import {
  CATEGORIAS,
  PRIORIDADES,
  type BorradorIncidencia,
  type CategoriaIncidencia,
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

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">
          Categoría
        </legend>
        <div className="grid gap-3 md:grid-cols-3">
          {CATEGORIAS.map((categoria) => (
            <label
              key={categoria}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                value.categoria === categoria
                  ? "border-teal-600 bg-teal-50 ring-2 ring-teal-100"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="categoria"
                value={categoria}
                checked={value.categoria === categoria}
                onChange={() =>
                  onChange("categoria", categoria as CategoriaIncidencia)
                }
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-slate-900">
                {CATEGORIA_META[categoria].etiqueta}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {CATEGORIA_META[categoria].resumen}
              </span>
            </label>
          ))}
        </div>
        {errors.categoria ? (
          <p className="mt-2 text-sm text-rose-700" role="alert">
            {errors.categoria}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
