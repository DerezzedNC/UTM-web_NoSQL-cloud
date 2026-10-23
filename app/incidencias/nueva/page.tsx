import { RegistroIncidenciaForm } from "@/components/incidencias/registro/RegistroIncidenciaForm";

export default function NuevaIncidenciaPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Registro de incidencia
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Caso de uso CU-01. El formulario arma un documento con campos
          universales, ubicación en campus y un subdocumento
          <span className="font-mono"> detalle_especifico</span> según la
          categoría operativa.
        </p>
      </div>
      <RegistroIncidenciaForm />
    </main>
  );
}
