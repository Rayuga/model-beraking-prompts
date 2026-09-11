export const IDS = {
  users: {
    nora: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    avery: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
    marcus: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001',
    priya: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002',
    devon: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0003',
    elena: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004',
    jamal: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0005',
    theo: 'cccccccc-cccc-cccc-cccc-cccccccc0001',
    quinn: 'cccccccc-cccc-cccc-cccc-cccccccc0002',
    rhea: 'cccccccc-cccc-cccc-cccc-cccccccc0003',
    kenji: 'cccccccc-cccc-cccc-cccc-cccccccc0004',
    lina: 'cccccccc-cccc-cccc-cccc-cccccccc0005',
    dana: 'dddddddd-dddd-dddd-dddd-dddddddd0001',
    ife: 'dddddddd-dddd-dddd-dddd-dddddddd0002',
    sam: 'dddddddd-dddd-dddd-dddd-dddddddd0003',
    gina: 'dddddddd-dddd-dddd-dddd-dddddddd0004',
    omar: 'dddddddd-dddd-dddd-dddd-dddddddd0005'
  },
  customers: {
    harlow: 'cust-harlow-freight-0001',
    nkemdirim: 'cust-nkemdirim-transit-02',
    blueridge: 'cust-blue-ridge-delivery3',
    costanza: 'cust-costanza-rideshare-4',
    meridian: 'cust-meridian-courier-005'
  },
  vehicles: {
    f150: 'veh-harlow-f150-00000001',
    tesla: 'veh-nkem-tesla-y-0000002',
    camry: 'veh-blueridge-camry-hyb3',
    freightliner: 'veh-harlow-freightliner4',
    civic: 'veh-costanza-civic-00005',
    bolt: 'veh-meridian-bolt-000006'
  },
  technicians: {
    marcus: 'tech-marcus-hale-0000001',
    priya: 'tech-priya-okonkwo-00002',
    devon: 'tech-devon-ruiz-00000003',
    elena: 'tech-elena-vasquez-00004',
    jamal: 'tech-jamal-wright-000005'
  },
  bays: {
    bay1: 'bay-1-general-lift-0001',
    bay2: 'bay-2-alignment-rack-02',
    bay3: 'bay-3-diagnostic-00003',
    bay4: 'bay-4-heavy-duty-hold04'
  },
  parts: {
    caliper: 'part-cal-front-l-000001',
    pads: 'part-pad-ceramic-f-00002',
    hybridBatt: 'part-hyb-batt-mod-00003',
    refrigerant: 'part-r134a-30lb-0000004',
    transFilter: 'part-trans-flt-10r80-05',
    alignKit: 'part-alg-tie-kit-000006',
    evCoolant: 'part-ev-cool-1g-0000007',
    rotor: 'part-rotor-front-l-00008'
  }
};

export const DEFAULT_USER_ID = IDS.users.nora;

export const ROLES = {
  SERVICE_ADVISOR: 'SERVICE_ADVISOR',
  TECHNICIAN: 'TECHNICIAN',
  SHOP_FOREMAN: 'SHOP_FOREMAN',
  PARTS_MANAGER: 'PARTS_MANAGER',
  SHOP_MANAGER: 'SHOP_MANAGER',
  WARRANTY_ADMIN: 'WARRANTY_ADMIN',
  CUSTOMER: 'CUSTOMER'
};

export const STAFF_ROLES = [
  ROLES.SERVICE_ADVISOR,
  ROLES.TECHNICIAN,
  ROLES.SHOP_FOREMAN,
  ROLES.PARTS_MANAGER,
  ROLES.SHOP_MANAGER,
  ROLES.WARRANTY_ADMIN
];
