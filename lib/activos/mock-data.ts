export type AssetStatus = "falla" | "operativo" | "preventivo";
export type AssetCategory = "switch" | "computo" | "ap" | "proyector";

export type Asset = {
  id: string;
  serial: string;
  name: string;
  category: AssetCategory;
  categoryLabel: string;
  icon: string;
  building: string;
  room: string;
  rack: string;
  campus: string;
  owner: string;
  initials: string;
  status: AssetStatus;
  ip: string;
  mac: string;
  vlan: string;
  warranty: string;
  lastMaintenance: string;
  nextMaintenance: string;
  poeInUse: number;
  poeTotal: number;
  snmpAlert: string;
  uplink: string;
  sfpPower: string;
  events: { title: string; date: string; detail: string; tone: "red" | "teal" | "indigo" }[];
};

export const ASSETS: Asset[] = [
  {
    id: "ACT-UTM-0892",
    serial: "FDO2419K2X",
    name: "Cisco Catalyst 9300 48P PoE+",
    category: "switch",
    categoryLabel: "Switch de Distribución",
    icon: "▣",
    building: "Edificio B",
    room: "Lab Cómputo 3",
    rack: "Rack 02 · U12",
    campus: "Campus Central",
    owner: "Ing. C. Morales",
    initials: "CM",
    status: "falla",
    ip: "10.24.110.29",
    mac: "60:26:EF:4A:1F:08",
    vlan: "48 (Infra-Mgmt)",
    warranty: "Cisco Smart Net Care",
    lastMaintenance: "14 Ene 2025",
    nextMaintenance: "14 Jul 2025",
    poeInUse: 42,
    poeTotal: 48,
    snmpAlert: "1 alerta SNMP",
    uplink: "1Gb Uplink",
    sfpPower: "Tx: -2.4 dBm · Rx: -3.1 dBm",
    events: [
      { title: "Ticket #UTM-2409: Caída Enlace PoE", date: "Hoy, Hace 2h", detail: "Interrupción de energía en puerto Gi0/48 afectando Access Point AP-535.", tone: "red" },
      { title: "Sustitución de PSU redundante", date: "12 Feb 2026", detail: "Reemplazo preventivo del módulo de alimentación PSU-2 por micro-corte.", tone: "teal" },
      { title: "Alta e Inventariado Inicial", date: "15 Mar 2024", detail: "Recepción, etiquetado RFID físico y aprovisionamiento con firmware base.", tone: "indigo" },
    ],
  },
  {
    id: "ACT-UTM-0914",
    serial: "H4K892D1",
    name: "Aruba AP-535 Wi-Fi 6",
    category: "ap",
    categoryLabel: "Punto de Acceso Campus",
    icon: "◉",
    building: "Biblioteca Central",
    room: "Planta 3",
    rack: "Rack 01 · U08",
    campus: "Campus Central",
    owner: "Lic. R. Peña",
    initials: "RP",
    status: "operativo",
    ip: "10.24.32.18",
    mac: "A8:BD:27:10:4C:91",
    vlan: "120 (WiFi-Staff)",
    warranty: "Aruba Foundation Care",
    lastMaintenance: "08 Feb 2026",
    nextMaintenance: "08 Aug 2026",
    poeInUse: 1,
    poeTotal: 1,
    snmpAlert: "Sin alertas SNMP",
    uplink: "1Gb Uplink",
    sfpPower: "Tx: -1.8 dBm · Rx: -2.9 dBm",
    events: [{ title: "Monitoreo preventivo", date: "08 Feb 2026", detail: "Se verificó cobertura y consumo PoE dentro de parámetros.", tone: "teal" }],
  },
  {
    id: "ACT-UTM-1120",
    serial: "NCD62913X",
    name: "Dell OptiPlex 7090 Tower",
    category: "computo",
    categoryLabel: "Estación de Trabajo",
    icon: "▤",
    building: "Edificio D",
    room: "Laboratorio 10",
    rack: "Mesa D-21",
    campus: "Campus Central",
    owner: "Ing. C. Morales",
    initials: "CM",
    status: "operativo",
    ip: "10.24.80.44",
    mac: "B4:96:91:20:3D:70",
    vlan: "210 (Labs)",
    warranty: "Dell ProSupport",
    lastMaintenance: "21 Ene 2026",
    nextMaintenance: "21 Jul 2026",
    poeInUse: 0,
    poeTotal: 0,
    snmpAlert: "No aplica",
    uplink: "1Gb Ethernet",
    sfpPower: "No aplica",
    events: [{ title: "Limpieza y mantenimiento", date: "21 Ene 2026", detail: "Limpieza interna y actualización de imagen institucional.", tone: "teal" }],
  },
  {
    id: "ACT-UTM-0456",
    serial: "MNL-850-9901",
    name: "Dell PowerEdge R650 2U",
    category: "computo",
    categoryLabel: "Nodo Virtualización",
    icon: "▤",
    building: "Data Center Principal",
    room: "Sala DC-01",
    rack: "Rack 02 · U31",
    campus: "Campus Central",
    owner: "SysAdmin Core",
    initials: "SC",
    status: "preventivo",
    ip: "10.24.1.12",
    mac: "D8:9E:F3:88:01:22",
    vlan: "10 (Core)",
    warranty: "Dell ProSupport Plus",
    lastMaintenance: "04 Mar 2026",
    nextMaintenance: "04 Jun 2026",
    poeInUse: 0,
    poeTotal: 0,
    snmpAlert: "Sin alertas SNMP",
    uplink: "10Gb Fiber",
    sfpPower: "Tx: -2.2 dBm · Rx: -3.4 dBm",
    events: [{ title: "Ventana preventiva programada", date: "04 Mar 2026", detail: "Revisión de discos y estado de fuentes redundantes.", tone: "indigo" }],
  },
  {
    id: "ACT-UTM-0219",
    serial: "EP-6317-88",
    name: "Proyector Epson EB-L630U",
    category: "proyector",
    categoryLabel: "Láser 6200 lúmenes",
    icon: "▰",
    building: "Auditorio Principal",
    room: "Montaje Técnico",
    rack: "Cabina 01",
    campus: "Campus Central",
    owner: "Lic. R. Peña",
    initials: "RP",
    status: "operativo",
    ip: "10.24.64.19",
    mac: "00:1D:C8:72:19:AA",
    vlan: "220 (AV)",
    warranty: "Epson CoverPlus",
    lastMaintenance: "17 Feb 2026",
    nextMaintenance: "17 Aug 2026",
    poeInUse: 0,
    poeTotal: 0,
    snmpAlert: "Sin alertas SNMP",
    uplink: "1Gb Ethernet",
    sfpPower: "No aplica",
    events: [{ title: "Alta e inventariado", date: "17 Feb 2026", detail: "Equipo incorporado al catálogo de activos audiovisuales.", tone: "teal" }],
  },
];
