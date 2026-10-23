import { ChipInput } from "@/components/ui/ChipInput";
import { Field, inputClass } from "@/components/ui/Field";
import type { DetalleComputoRedes as DetalleComputoRedesValue } from "@/lib/incidencias/types";

type DetalleComputoRedesProps = {
  value: DetalleComputoRedesValue;
  errors: Record<string, string>;
  onChange: (value: DetalleComputoRedesValue) => void;
};

export function DetalleComputoRedes({
  value,
  errors,
  onChange,
}: DetalleComputoRedesProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="direccion_ip"
        label="Dirección IP"
        hint="IPv4 del equipo o segmento afectado."
        error={errors["detalle_especifico.direccion_ip"]}
      >
        <input
          id="direccion_ip"
          value={value.direccion_ip}
          onChange={(event) =>
            onChange({ ...value, direccion_ip: event.target.value })
          }
          placeholder="192.168.10.24"
          inputMode="decimal"
          className={inputClass(
            Boolean(errors["detalle_especifico.direccion_ip"]),
          )}
        />
      </Field>
      <Field
        id="vlan"
        label="VLAN"
        hint="Identificador entre 1 y 4094."
        error={errors["detalle_especifico.vlan"]}
      >
        <input
          id="vlan"
          value={value.vlan}
          onChange={(event) => onChange({ ...value, vlan: event.target.value })}
          placeholder="120"
          inputMode="numeric"
          className={inputClass(Boolean(errors["detalle_especifico.vlan"]))}
        />
      </Field>
      <Field
        id="puerto_uplink"
        label="Puerto uplink"
        error={errors["detalle_especifico.puerto_uplink"]}
      >
        <input
          id="puerto_uplink"
          value={value.puerto_uplink}
          onChange={(event) =>
            onChange({ ...value, puerto_uplink: event.target.value })
          }
          placeholder="Gi1/0/24"
          className={inputClass(
            Boolean(errors["detalle_especifico.puerto_uplink"]),
          )}
        />
      </Field>
      <div className="sm:col-span-2">
        <ChipInput
          id="equipos_afectados"
          label="Equipos afectados"
          hint="Escribe un equipo y pulsa Agregar o Enter."
          placeholder="Switch A-201"
          values={value.equipos_afectados}
          error={errors["detalle_especifico.equipos_afectados"]}
          onChange={(equipos_afectados) =>
            onChange({ ...value, equipos_afectados })
          }
        />
      </div>
    </div>
  );
}
