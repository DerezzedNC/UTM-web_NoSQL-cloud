"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usuarioSchema, type UsuarioPayload } from "@/lib/usuarios/schema";
import {
  USUARIOS_INICIALES,
  type AreaAsignada,
  type RolRBAC,
  type RolInstitucional,
  type Usuario,
} from "@/lib/usuarios/types";

const roles: { value: "todos" | RolRBAC; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "admin", label: "Admin" },
  { value: "directiva", label: "Directiva" },
  { value: "coordinador", label: "Coordinador" },
  { value: "tecnico", label: "Técnico" },
  { value: "reportante", label: "Reportante" },
];
const departments = ["Dirección de TI", "Infraestructura y TI", "Ingeniería de Sistemas", "Rectorado", "Campus Norte", "Servicios Académicos"];
const areaLabels: Record<AreaAsignada, string> = { computo_redes: "Cómputo y Redes", infraestructura: "Infraestructura", academico: "Académico" };
const roleLabels: Record<RolRBAC, string> = { admin: "Administrador", directiva: "Directiva", coordinador: "Coordinador", tecnico: "Técnico", reportante: "Reportante" };

type UserForm = {
  id_usuario: string;
  nombre: string;
  correo: string;
  departamento: string;
  rol: RolRBAC;
  activo: boolean;
  area_asignada: AreaAsignada;
  rol_institucional: RolInstitucional;
};

const emptyForm: UserForm = {
  id_usuario: "",
  nombre: "",
  correo: "",
  departamento: "",
  rol: "tecnico",
  activo: true,
  area_asignada: "computo_redes",
  rol_institucional: "Docente",
};

function Badge({ role }: { role: RolRBAC }) {
  const colors: Record<RolRBAC, string> = { admin: "bg-teal-100 text-teal-800", directiva: "bg-indigo-100 text-indigo-700", coordinador: "bg-violet-100 text-violet-700", tecnico: "bg-emerald-100 text-emerald-700", reportante: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${colors[role]}`}>{roleLabels[role]}</span>;
}

function Field({ label, value, onChange, error, placeholder }: { label: string; value: string; onChange: (value: string) => void; error?: string; placeholder?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-teal-500 ${error ? "border-rose-400" : "border-slate-200"}`} />{error ? <span className="mt-1 block text-[10px] font-normal normal-case text-rose-600">{error}</span> : null}</label>;
}

export default function UsuariosPage() {
  const [activeRole, setActiveRole] = useState<RolRBAC>("admin");
  const [users, setUsers] = useState(USUARIOS_INICIALES);
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<"todos" | RolRBAC>("todos");
  const [selected, setSelected] = useState<Usuario | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const filteredUsers = useMemo(() => users.filter((user) => {
    const text = `${user.id_usuario} ${user.nombre} ${user.correo}`.toLocaleLowerCase("es-MX");
    return text.includes(query.toLocaleLowerCase("es-MX")) && (filterRole === "todos" || user.rol === filterRole);
  }), [users, query, filterRole]);
  const isAdmin = activeRole === "admin";

  function openCreate() {
    setSelected(null);
    setForm(emptyForm);
    setErrors({});
    setNotice("");
  }

  function openEdit(user: Usuario) {
    setSelected(user);
    setForm({ ...emptyForm, ...user });
    setErrors({});
    setNotice("");
  }

  function updateForm<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[String(key)];
      return next;
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload: UsuarioPayload = form.rol === "tecnico"
      ? { id_usuario: form.id_usuario, nombre: form.nombre, correo: form.correo, departamento: form.departamento, rol: form.rol, activo: form.activo, area_asignada: form.area_asignada }
      : form.rol === "reportante"
        ? { id_usuario: form.id_usuario, nombre: form.nombre, correo: form.correo, departamento: form.departamento, rol: form.rol, activo: form.activo, rol_institucional: form.rol_institucional }
        : { id_usuario: form.id_usuario, nombre: form.nombre, correo: form.correo, departamento: form.departamento, rol: form.rol, activo: form.activo };
    const result = usuarioSchema.safeParse(payload);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setNotice("Revisa los campos marcados para cumplir el $jsonSchema.");
      return;
    }
    const created: Usuario = {
      _id: `demo-${crypto.randomUUID()}`,
      ...result.data,
    };
    setUsers((current) => [...current, created]);
    setNotice(`Usuario ${created.id_usuario} agregado a la demo local.`);
    setForm(emptyForm);
  }

  function toggleActive(user: Usuario) {
    if (!isAdmin) return;
    setUsers((current) => current.map((item) => item._id === user._id ? { ...item, activo: !item.activo } : item));
  }

  return <div className="min-h-[calc(100vh-73px)] bg-[#f8f7ff] text-slate-800">
    <div className="flex min-h-[calc(100vh-73px)]">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link href="/" className="mb-7 flex items-center gap-2 px-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-[10px] font-bold text-white">UTM</span><span><b className="block text-xs">UTM Desk</b><small className="font-mono text-[8px] tracking-widest text-slate-400">NoSQL CLOUD OPS</small></span></Link>
        <p className="px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Role scope</p>
        <select value={activeRole} onChange={(event) => setActiveRole(event.target.value as RolRBAC)} className="mt-2 w-full rounded-md border border-teal-200 bg-teal-50 px-2 py-1.5 text-[10px] font-bold uppercase text-teal-800">{roles.filter((item) => item.value !== "todos").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <nav className="mt-5 space-y-1 text-xs font-medium"><Link href="/incidencias" className="block rounded-lg px-3 py-2.5 text-slate-600">▣ Bandeja de Tickets</Link><Link href="/incidencias/nueva" className="block rounded-lg px-3 py-2.5 text-slate-600">⊕ Nueva Incidencia</Link><Link href="/analitica" className="block rounded-lg px-3 py-2.5 text-slate-600">▥ Dashboard Ejecutivo</Link><span className="block rounded-lg bg-teal-700 px-3 py-2.5 text-white">♙ Usuarios y Accesos</span></nav>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 sm:px-8"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Sede activa</p><p className="text-xs font-bold text-slate-700">Campus Central UTM</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">● Sync: Cluster Node 04</span><span className="grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-xs text-white">CM</span></header>
        <div className="mx-auto max-w-[1500px] p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">Seguridad y Auditoría · Gestión de accesos</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Administración de Identidades y Control de Acceso (RBAC)</h1><p className="mt-1 text-xs text-slate-500">Colección NoSQL: <span className="font-mono">usuarios</span> · Validador discriminado <span className="font-mono">oneOf</span></p></div><button onClick={openCreate} disabled={!isAdmin} className="rounded-lg bg-teal-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">＋ Registrar Usuario Institucional</button></div>
          {!isAdmin ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center"><p className="text-3xl">🔒</p><h2 className="mt-3 text-lg font-bold text-amber-900">Acceso restringido</h2><p className="mt-1 text-sm text-amber-800">La administración de identidades es exclusiva del rol <b>admin</b>.</p></section> : <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Total cuentas activas" value={String(users.filter((user) => user.activo && user.correo.endsWith("@utm.edu.mx")).length)} detail="@utm.edu.mx · índices únicos" /><Kpi label="Cuerpo técnico" value={String(users.filter((user) => user.rol === "tecnico").length)} detail="100% áreas asignadas" /><Kpi label="Coordinación & directiva" value={String(users.filter((user) => user.rol === "coordinador" || user.rol === "directiva").length)} detail="cuentas ejecutivas" /><Kpi label="Índice único correo / clave" value="100%" detail="integridad BSON" /></section>
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ID, nombre o correo institucional..." className="min-w-[260px] flex-1 rounded-lg bg-slate-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-teal-100" />{roles.map((item) => <button key={item.value} onClick={() => setFilterRole(item.value)} className={`rounded-md px-3 py-2 text-[10px] font-semibold ${filterRole === item.value ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-slate-50"}`}>{item.label}</button>)}</div></section>
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]"><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-3"><p className="text-xs font-bold text-slate-700">{filteredUsers.length} usuarios encontrados</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Clave ID</th><th className="px-4 py-3">Nombre / correo institucional</th><th className="px-4 py-3">Rol RBAC</th><th className="px-4 py-3">Atributo polimórfico</th><th className="px-4 py-3">Departamento</th><th className="px-4 py-3">Activo</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredUsers.map((user) => <tr key={user._id} onClick={() => openEdit(user)} className="cursor-pointer hover:bg-teal-50"><td className="px-4 py-4 font-mono text-[11px] font-bold text-teal-700">{user.id_usuario}</td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{user.nombre}</p><p className="mt-1 text-[10px] text-slate-400">{user.correo}</p></td><td className="px-4 py-4"><Badge role={user.rol} /></td><td className="px-4 py-4">{user.rol === "tecnico" ? <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">Área: {areaLabels[user.area_asignada!]}</span> : user.rol === "reportante" ? <span className="rounded bg-indigo-50 px-2 py-1 text-[10px] text-indigo-700">Cargo: {user.rol_institucional}</span> : <span className="text-[10px] text-slate-400">Sin extensión</span>}</td><td className="px-4 py-4 text-[10px] text-slate-500">{user.departamento}</td><td className="px-4 py-4"><button onClick={(event) => { event.stopPropagation(); toggleActive(user); }} className={`relative h-5 w-9 rounded-full ${user.activo ? "bg-teal-700" : "bg-slate-300"}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${user.activo ? "left-5" : "left-1"}`} /></button></td></tr>)}</tbody></table></div></section>
              <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-sm font-bold text-slate-900">{selected ? "Editar usuario" : "Alta / Edición de Usuario"}</h2><p className="mt-1 text-[10px] text-slate-400">Validador <span className="font-mono">oneOf</span> activo</p></div>{selected ? <button onClick={openCreate} className="text-xs text-slate-400">＋ Nuevo</button> : null}</div><div className="mt-4 rounded-lg bg-indigo-50 p-3 text-[10px] leading-4 text-indigo-800">La colección aplica atributos condicionales según el rol seleccionado. Los esquemas oneOf se validan antes de guardar.</div><form onSubmit={save} className="mt-4 space-y-3"><Field label="Clave ID usuario" value={form.id_usuario} onChange={(value) => updateForm("id_usuario", value)} error={errors.id_usuario} placeholder="TEC-0412" /><Field label="Nombre completo" value={form.nombre} onChange={(value) => updateForm("nombre", value)} error={errors.nombre} placeholder="Alejandro Guzmán Rivera" /><Field label="Correo institucional" value={form.correo} onChange={(value) => updateForm("correo", value)} error={errors.correo} placeholder="a.guzman@utm.edu.mx" /><label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Departamento<select value={form.departamento} onChange={(event) => updateForm("departamento", event.target.value)} className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-xs font-normal normal-case tracking-normal ${errors.departamento ? "border-rose-400" : "border-slate-200"}`}><option value="">Seleccionar departamento...</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label><label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Rol RBAC<select value={form.rol} onChange={(event) => updateForm("rol", event.target.value as RolRBAC)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal normal-case tracking-normal">{roles.filter((item) => item.value !== "todos").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{form.rol === "tecnico" ? <label className="block rounded-lg bg-emerald-50 p-3 text-[10px] font-bold uppercase tracking-wide text-emerald-800">Área asignada<select value={form.area_asignada} onChange={(event) => updateForm("area_asignada", event.target.value as AreaAsignada)} className="mt-1 w-full rounded border border-emerald-200 bg-white px-2 py-2 text-xs font-normal normal-case">{Object.entries(areaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}{form.rol === "reportante" ? <label className="block rounded-lg bg-indigo-50 p-3 text-[10px] font-bold uppercase tracking-wide text-indigo-800">Rol institucional<select value={form.rol_institucional} onChange={(event) => updateForm("rol_institucional", event.target.value as RolInstitucional)} className="mt-1 w-full rounded border border-indigo-200 bg-white px-2 py-2 text-xs font-normal normal-case">{["Docente", "Estudiante", "Administrativo"].map((value) => <option key={value}>{value}</option>)}</select></label> : null}<label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={form.activo} onChange={(event) => updateForm("activo", event.target.checked)} className="accent-teal-700" /> Cuenta activa</label>{notice ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600">{notice}</p> : null}<button type="submit" className="w-full rounded-lg bg-teal-800 px-4 py-3 text-xs font-bold text-white">Guardar en Colección usuarios</button><button type="button" onClick={openCreate} className="w-full rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-600">Cancelar / Limpiar</button></form></aside></div>
            </>}
        </div>
      </main>
    </div>
  </div>;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><strong className="mt-2 block text-2xl text-slate-900">{value}</strong><p className="mt-2 text-[10px] text-teal-700">{detail}</p><div className="mt-3 h-1 rounded bg-teal-100"><div className="h-1 w-2/3 rounded bg-teal-700" /></div></article>;
}
