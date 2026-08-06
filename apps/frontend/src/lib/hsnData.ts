export interface HsnCode {
  id: string;
  code: string;
  description: string;
}

export const HSN_SEED_DATA: HsnCode[] = [
  { id: '1', code: '998313', description: 'Information technology (IT) design and development services' },
  { id: '2', code: '998314', description: 'Information technology (IT) infrastructure and network management services' },
  { id: '3', code: '998315', description: 'Hosting and information technology (IT) infrastructure provisioning services' },
  { id: '4', code: '998713', description: 'Maintenance and repair services of computers and peripheral equipment' },
  { id: '5', code: '998311', description: 'Management consulting services' },
  { id: '6', code: '847130', description: 'Portable automatic data processing machines (Laptops, Notebooks)' },
  { id: '7', code: '847141', description: 'Other digital automatic data processing machines (Desktop computers)' },
  { id: '8', code: '850440', description: 'Static converters (UPS, Inverters)' },
  { id: '9', code: '851762', description: 'Machines for the reception, conversion and transmission or regeneration of voice, images or other data (Routers, Switches)' },
  { id: '10', code: '998319', description: 'Other information technology services n.e.c.' }
];
