import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { incidenciaCampusSchema } from "../lib/incidencias/schema";
import { registroIncidenciaSchema } from "../lib/incidencias/registro-schema";

describe("Validación de esquemas Zod unificados (Contrato MongoDB Atlas)", () => {
  test("Garantiza que registroIncidenciaSchema e incidenciaCampusSchema compartan el mismo contrato canónico", () => {
    assert.equal(registroIncidenciaSchema, incidenciaCampusSchema);
  });

  test("Acepta payload válido de computo_redes con coerción y valores canónicos", () => {
    const raw = {
      titulo: "Falla de conectividad en Laboratorio A",
      descripcion: "El switch principal no responde tras corte de energía.",
      categoria: "computo_redes",
      prioridad: "alta",
      ubicacion: {
        edificio: "Edificio 3",
        piso: "Planta Baja",
        aula_laboratorio: "Laboratorio A",
      },
      reportante: {
        id_usuario: "usr_doc_01",
        nombre: "Profesor Martínez",
        rol: "Docente",
        correo: "martinez@utm.edu.mx",
      },
      detalle_especifico: {
        direccion_ip: "192.168.10.25",
        vlan: "20",
        puerto_uplink: "Gi0/1",
        equipos_afectados: "5",
      },
    };

    const parsed = registroIncidenciaSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.categoria, "computo_redes");
      assert.equal(parsed.data.reportante.rol_institucional, "Docente");
      assert.deepEqual(parsed.data.tags, []);
      if (parsed.data.categoria === "computo_redes") {
        assert.equal(parsed.data.detalle_especifico.vlan, 20);
        assert.equal(parsed.data.detalle_especifico.equipos_afectados, 5);
      }
    }
  });

  test("Normaliza 'Crítico' con tilde a 'Critico' canónico en infraestructura", () => {
    const raw = {
      titulo: "Fuga de gas en cafetería central",
      descripcion: "Se detecta olor a gas cerca de las líneas de suministro principales.",
      categoria: "infraestructura",
      prioridad: "critica",
      ubicacion: {
        edificio: "Edificio Central",
        piso: "1",
        aula_laboratorio: "Cafetería",
      },
      reportante: {
        id_usuario: "usr_adm_02",
        nombre: "Lic. González",
        rol_institucional: "Administrativo",
        correo: "gonzalez@utm.edu.mx",
      },
      tags: ["seguridad", "urgente"],
      detalle_especifico: {
        tipo_dano: "Fuga en válvula de baja presión",
        riesgo_seguridad: "Crítico", // con tilde
        requiere_insumos: true,
        insumos_solicitados: ["Válvula de 1/2 pulgada", "Sellador"],
        contratista_externo: false,
      },
    };

    const parsed = registroIncidenciaSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (parsed.success && parsed.data.categoria === "infraestructura") {
      assert.equal(parsed.data.detalle_especifico.riesgo_seguridad, "Critico");
      assert.equal(parsed.data.reportante.rol_institucional, "Administrativo");
      assert.deepEqual(parsed.data.tags, ["seguridad", "urgente"]);
    }
  });

  test("Acepta payload académico con estudiantes_impactados >= 1", () => {
    const raw = {
      titulo: "Plataforma Moodle inaccesible para examen",
      descripcion: "Los estudiantes del grupo 502 no pueden ingresar al examen parcial.",
      categoria: "academico",
      prioridad: "alta",
      ubicacion: {
        edificio: "Edificio 2",
        piso: "2",
        aula_laboratorio: "Aula 204",
      },
      reportante: {
        id_usuario: "usr_doc_03",
        nombre: "Dra. Ramos",
        rol_institucional: "Docente",
        correo: "ramos@utm.edu.mx",
      },
      detalle_especifico: {
        plataforma: "Moodle Campus",
        codigo_curso: "CS-401",
        periodo_escolar: "2026-A",
        estudiantes_impactados: "35",
      },
    };

    const parsed = registroIncidenciaSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (parsed.success && parsed.data.categoria === "academico") {
      assert.equal(parsed.data.detalle_especifico.estudiantes_impactados, 35);
    }
  });

  test("Rechaza equipos_afectados < 1 en computo_redes para cumplir $jsonSchema", () => {
    const raw = {
      titulo: "Falla de switch secundario en rack",
      descripcion: "Switch sin enlace hacia distribución.",
      categoria: "computo_redes",
      prioridad: "media",
      ubicacion: {
        edificio: "Edificio 1",
        piso: "1",
        aula_laboratorio: "Rack 1",
      },
      reportante: {
        id_usuario: "usr_rep_01",
        nombre: "Juan Pérez",
        rol: "Estudiante",
        correo: "juan@utm.edu.mx",
      },
      detalle_especifico: {
        direccion_ip: "10.0.0.1",
        vlan: 10,
        puerto_uplink: "Gi0/24",
        equipos_afectados: 0, // Incompatible con minimum: 1
      },
    };

    const parsed = registroIncidenciaSchema.safeParse(raw);
    assert.equal(parsed.success, false);
  });

  test("Rechaza VLAN fuera de rango (1-4094)", () => {
    const raw = {
      titulo: "VLAN inválida configurada en puerto",
      descripcion: "Error en configuración de enlace troncal.",
      categoria: "computo_redes",
      prioridad: "baja",
      ubicacion: {
        edificio: "Edificio 1",
        piso: "1",
        aula_laboratorio: "Lab Redes",
      },
      reportante: {
        id_usuario: "usr_rep_01",
        nombre: "Juan Pérez",
        rol: "Estudiante",
        correo: "juan@utm.edu.mx",
      },
      detalle_especifico: {
        direccion_ip: "10.0.0.2",
        vlan: 5000, // Fuera de rango
        puerto_uplink: "Gi0/1",
        equipos_afectados: 1,
      },
    };

    const parsed = registroIncidenciaSchema.safeParse(raw);
    assert.equal(parsed.success, false);
  });

  test("Rechaza riesgo_seguridad no reconocido", () => {
    const raw = {
      titulo: "Falla de luminaria en pasillo",
      descripcion: "Luminaria parpadeando de forma constante.",
      categoria: "infraestructura",
      prioridad: "baja",
      ubicacion: {
        edificio: "Edificio 2",
        piso: "1",
        aula_laboratorio: "Pasillo B",
      },
      reportante: {
        id_usuario: "usr_rep_01",
        nombre: "Juan Pérez",
        rol: "Estudiante",
        correo: "juan@utm.edu.mx",
      },
      detalle_especifico: {
        tipo_dano: "Balastra dañada",
        riesgo_seguridad: "Peligroso", // No en enum ["Bajo", "Medio", "Alto", "Critico"]
        requiere_insumos: true,
        contratista_externo: false,
      },
    };

    const parsed = registroIncidenciaSchema.safeParse(raw);
    assert.equal(parsed.success, false);
  });
});
