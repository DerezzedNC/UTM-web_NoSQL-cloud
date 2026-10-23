import { Field, inputClass } from "@/components/ui/Field";
import type { UbicacionCampus } from "@/lib/incidencias/types";

type CamposUbicacionProps = {
  value: UbicacionCampus;
  errors: Record<string, string>;
  onChange: (value: UbicacionCampus) => void;
};

export function CamposUbicacion({
  value,
  errors,
  onChange,
}: CamposUbicacionProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <Field
        id="edificio"
        label="Edificio"
        error={errors["ubicacion.edificio"]}
      >
        <input
          id="edificio"
          value={value.edificio}
          onChange={(event) =>
            onChange({ ...value, edificio: event.target.value })
          }
          placeholder="Ej. Edificio A"
          className={inputClass(Boolean(errors["ubicacion.edificio"]))}
        />
      </Field>
      <Field id="piso" label="Piso" error={errors["ubicacion.piso"]}>
        <input
          id="piso"
          value={value.piso}
          onChange={(event) => onChange({ ...value, piso: event.target.value })}
          placeholder="Ej. 2 o PB"
          className={inputClass(Boolean(errors["ubicacion.piso"]))}
        />
      </Field>
      <Field
        id="aula_laboratorio"
        label="Aula o laboratorio"
        error={errors["ubicacion.aula_laboratorio"]}
      >
        <input
          id="aula_laboratorio"
          value={value.aula_laboratorio}
          onChange={(event) =>
            onChange({ ...value, aula_laboratorio: event.target.value })
          }
          placeholder="Ej. Lab. Redes 3"
          className={inputClass(Boolean(errors["ubicacion.aula_laboratorio"]))}
        />
      </Field>
    </section>
  );
}
