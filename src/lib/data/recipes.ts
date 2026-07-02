/**
 * GERADO a partir dos dados do autor (xlsx) — NÃO editar à mão. Regenerar:
 *   node scripts/gerar-seed.mjs <paleta-V2-limpa.xlsx> <pratos-V2.xlsx>
 * Fonte: cofre (banco-alimentos V2 limpa + pratos V2, 2026-07-01). Validado Δ=0
 * (167 alimentos · 96 pratos · 363 ingredientes · tipos 35/29/32 · Atwater ≤12%).
 */
import type { Recipe } from './types';

export const RECIPES: Recipe[] = [
  {
    "id": "p1",
    "nome": "Arroz, feijão carioca e brócolis refogado",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 130.0
      },
      {
        "alimentoId": "a97",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p2",
    "nome": "Arroz integral, feijão preto e couve",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a48",
        "gramas": 100.0
      },
      {
        "alimentoId": "a43",
        "gramas": 130.0
      },
      {
        "alimentoId": "a103",
        "gramas": 40.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p3",
    "nome": "Tofu grelhado com arroz e brócolis",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a47",
        "gramas": 120.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a97",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "soja"
    ]
  },
  {
    "id": "p4",
    "nome": "Lentilha com arroz e cenoura",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a46",
        "gramas": 80.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a100",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p5",
    "nome": "Macarrão ao sugo com legumes",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a59",
        "gramas": 80.0
      },
      {
        "alimentoId": "a111",
        "gramas": 80.0
      },
      {
        "alimentoId": "a90",
        "gramas": 50.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": [
      "gluten"
    ]
  },
  {
    "id": "p6",
    "nome": "Arroz, feijão e abóbora refogada",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 130.0
      },
      {
        "alimentoId": "a91",
        "gramas": 80.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p7",
    "nome": "Tofu refogado com legumes e arroz integral",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a47",
        "gramas": 100.0
      },
      {
        "alimentoId": "a48",
        "gramas": 100.0
      },
      {
        "alimentoId": "a112",
        "gramas": 50.0
      },
      {
        "alimentoId": "a100",
        "gramas": 50.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "soja"
    ]
  },
  {
    "id": "p8",
    "nome": "Feijão tropeiro vegano",
    "refeicoes": [
      "almoco"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a41",
        "gramas": 130.0
      },
      {
        "alimentoId": "a55",
        "gramas": 20.0
      },
      {
        "alimentoId": "a103",
        "gramas": 30.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p9",
    "nome": "Salada de feijão-fradinho com tomate e cebola",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a42",
        "gramas": 100.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a107",
        "gramas": 30.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p10",
    "nome": "Escondidinho vegano de mandioca com lentilha",
    "refeicoes": [
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a60",
        "gramas": 150.0
      },
      {
        "alimentoId": "a46",
        "gramas": 80.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p11",
    "nome": "Batata-doce com tofu e brócolis",
    "refeicoes": [
      "almoco"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a52",
        "gramas": 120.0
      },
      {
        "alimentoId": "a47",
        "gramas": 100.0
      },
      {
        "alimentoId": "a97",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "soja"
    ]
  },
  {
    "id": "p12",
    "nome": "Polenta com molho de tomate e legumes",
    "refeicoes": [
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a64",
        "gramas": 150.0
      },
      {
        "alimentoId": "a111",
        "gramas": 60.0
      },
      {
        "alimentoId": "a90",
        "gramas": 40.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p13",
    "nome": "Vitamina de banana com aveia",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a72",
        "gramas": 100.0
      },
      {
        "alimentoId": "a50",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p14",
    "nome": "Aveia com banana e linhaça",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a50",
        "gramas": 40.0
      },
      {
        "alimentoId": "a72",
        "gramas": 70.0
      },
      {
        "alimentoId": "a120",
        "gramas": 10.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p15",
    "nome": "Mamão com aveia e castanha-de-caju",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a79",
        "gramas": 150.0
      },
      {
        "alimentoId": "a50",
        "gramas": 20.0
      },
      {
        "alimentoId": "a116",
        "gramas": 15.0
      }
    ],
    "contemAlergenos": [
      "castanhas"
    ]
  },
  {
    "id": "p16",
    "nome": "Salada de folhas com abacate e gergelim",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a93",
        "gramas": 40.0
      },
      {
        "alimentoId": "a110",
        "gramas": 30.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      },
      {
        "alimentoId": "a68",
        "gramas": 50.0
      },
      {
        "alimentoId": "a119",
        "gramas": 10.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": [
      "gergelim"
    ]
  },
  {
    "id": "p17",
    "nome": "Arroz, feijão roxo e legumes no vapor",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a44",
        "gramas": 130.0
      },
      {
        "alimentoId": "a112",
        "gramas": 50.0
      },
      {
        "alimentoId": "a100",
        "gramas": 50.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p18",
    "nome": "Banana com pasta de amendoim",
    "refeicoes": [
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a72",
        "gramas": 100.0
      },
      {
        "alimentoId": "a113",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "amendoim"
    ]
  },
  {
    "id": "p19",
    "nome": "Cará cozido com feijão e couve",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a54",
        "gramas": 150.0
      },
      {
        "alimentoId": "a41",
        "gramas": 130.0
      },
      {
        "alimentoId": "a103",
        "gramas": 30.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p20",
    "nome": "Salada de feijão-fradinho com milho e tomate",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a42",
        "gramas": 100.0
      },
      {
        "alimentoId": "a62",
        "gramas": 40.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p21",
    "nome": "Ovos mexidos com pão francês",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a18",
        "gramas": 100.0
      },
      {
        "alimentoId": "a67",
        "gramas": 50.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p22",
    "nome": "Omelete com tomate e queijo",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a18",
        "gramas": 100.0
      },
      {
        "alimentoId": "a111",
        "gramas": 40.0
      },
      {
        "alimentoId": "a35",
        "gramas": 30.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p23",
    "nome": "Iogurte com aveia e banana",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a29",
        "gramas": 170.0
      },
      {
        "alimentoId": "a50",
        "gramas": 30.0
      },
      {
        "alimentoId": "a72",
        "gramas": 70.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p24",
    "nome": "Iogurte com morango e aveia",
    "refeicoes": [
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a29",
        "gramas": 170.0
      },
      {
        "alimentoId": "a85",
        "gramas": 80.0
      },
      {
        "alimentoId": "a50",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p25",
    "nome": "Pão integral com queijo minas",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a66",
        "gramas": 50.0
      },
      {
        "alimentoId": "a34",
        "gramas": 50.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p26",
    "nome": "Vitamina de banana com leite e aveia",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a32",
        "gramas": 200.0
      },
      {
        "alimentoId": "a72",
        "gramas": 70.0
      },
      {
        "alimentoId": "a50",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p27",
    "nome": "Arroz, feijão e ovo frito",
    "refeicoes": [
      "almoco"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 130.0
      },
      {
        "alimentoId": "a19",
        "gramas": 50.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p28",
    "nome": "Macarrão ao sugo com parmesão",
    "refeicoes": [
      "jantar"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a59",
        "gramas": 80.0
      },
      {
        "alimentoId": "a111",
        "gramas": 80.0
      },
      {
        "alimentoId": "a36",
        "gramas": 15.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p29",
    "nome": "Panqueca de queijo",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a57",
        "gramas": 30.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a32",
        "gramas": 80.0
      },
      {
        "alimentoId": "a34",
        "gramas": 40.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p30",
    "nome": "Risoto de legumes com parmesão",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a90",
        "gramas": 40.0
      },
      {
        "alimentoId": "a100",
        "gramas": 40.0
      },
      {
        "alimentoId": "a36",
        "gramas": 15.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p31",
    "nome": "Escondidinho de mandioca com ovo e queijo",
    "refeicoes": [
      "jantar"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a60",
        "gramas": 150.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a35",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p32",
    "nome": "Omelete de espinafre",
    "refeicoes": [
      "cafe",
      "almoco"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a18",
        "gramas": 100.0
      },
      {
        "alimentoId": "a105",
        "gramas": 40.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p33",
    "nome": "Torrada integral com ricota e tomate",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a66",
        "gramas": 50.0
      },
      {
        "alimentoId": "a39",
        "gramas": 40.0
      },
      {
        "alimentoId": "a111",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p34",
    "nome": "Salada de folhas com ovo e queijo minas",
    "refeicoes": [
      "almoco"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a93",
        "gramas": 40.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a34",
        "gramas": 40.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p35",
    "nome": "Batata cozida com ovo e brócolis",
    "refeicoes": [
      "almoco"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a53",
        "gramas": 150.0
      },
      {
        "alimentoId": "a18",
        "gramas": 100.0
      },
      {
        "alimentoId": "a97",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p36",
    "nome": "Iogurte com mamão e aveia",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a29",
        "gramas": 170.0
      },
      {
        "alimentoId": "a79",
        "gramas": 120.0
      },
      {
        "alimentoId": "a50",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p37",
    "nome": "Arroz com legumes e ovo mexido",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a100",
        "gramas": 40.0
      },
      {
        "alimentoId": "a112",
        "gramas": 40.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p38",
    "nome": "Arroz, feijão e bife (contra-filé)",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 130.0
      },
      {
        "alimentoId": "a5",
        "gramas": 100.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p39",
    "nome": "Arroz, feijão e frango grelhado",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 130.0
      },
      {
        "alimentoId": "a14",
        "gramas": 100.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p40",
    "nome": "Strogonoff de frango com arroz",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a14",
        "gramas": 120.0
      },
      {
        "alimentoId": "a28",
        "gramas": 40.0
      },
      {
        "alimentoId": "a111",
        "gramas": 20.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p41",
    "nome": "Strogonoff de carne com arroz",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a9",
        "gramas": 120.0
      },
      {
        "alimentoId": "a28",
        "gramas": 40.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p42",
    "nome": "Macarrão à bolonhesa",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a59",
        "gramas": 80.0
      },
      {
        "alimentoId": "a4",
        "gramas": 100.0
      },
      {
        "alimentoId": "a111",
        "gramas": 80.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "gluten",
      "origem_animal"
    ]
  },
  {
    "id": "p43",
    "nome": "Frango grelhado com batata e legumes",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a14",
        "gramas": 120.0
      },
      {
        "alimentoId": "a53",
        "gramas": 150.0
      },
      {
        "alimentoId": "a100",
        "gramas": 50.0
      },
      {
        "alimentoId": "a112",
        "gramas": 50.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p44",
    "nome": "Merluza assada com arroz e salada",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a16",
        "gramas": 120.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a93",
        "gramas": 40.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "peixe_frutos_do_mar"
    ]
  },
  {
    "id": "p45",
    "nome": "Salmão grelhado com batata-doce e brócolis",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a25",
        "gramas": 120.0
      },
      {
        "alimentoId": "a52",
        "gramas": 120.0
      },
      {
        "alimentoId": "a97",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "peixe_frutos_do_mar"
    ]
  },
  {
    "id": "p46",
    "nome": "Carne assada (lagarto) com mandioca",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a8",
        "gramas": 120.0
      },
      {
        "alimentoId": "a60",
        "gramas": 150.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p47",
    "nome": "Feijão preto com lombo e arroz",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a43",
        "gramas": 130.0
      },
      {
        "alimentoId": "a23",
        "gramas": 80.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p48",
    "nome": "Escondidinho de carne com mandioca",
    "refeicoes": [
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a60",
        "gramas": 150.0
      },
      {
        "alimentoId": "a4",
        "gramas": 100.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p49",
    "nome": "Frango refogado com pimentão e arroz",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a14",
        "gramas": 120.0
      },
      {
        "alimentoId": "a107",
        "gramas": 40.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p50",
    "nome": "Arroz integral com frango e brócolis",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a48",
        "gramas": 100.0
      },
      {
        "alimentoId": "a14",
        "gramas": 120.0
      },
      {
        "alimentoId": "a97",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p51",
    "nome": "Salada completa com atum e ovo",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a93",
        "gramas": 40.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      },
      {
        "alimentoId": "a1",
        "gramas": 60.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "ovo",
      "peixe_frutos_do_mar"
    ]
  },
  {
    "id": "p52",
    "nome": "Panqueca de frango",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a57",
        "gramas": 30.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a32",
        "gramas": 80.0
      },
      {
        "alimentoId": "a14",
        "gramas": 80.0
      },
      {
        "alimentoId": "a111",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "gluten",
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p53",
    "nome": "Bisteca de porco com arroz e salada",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a22",
        "gramas": 90.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a93",
        "gramas": 40.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p54",
    "nome": "Sardinha assada com arroz e feijão",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a26",
        "gramas": 80.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 130.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "peixe_frutos_do_mar"
    ]
  },
  {
    "id": "p55",
    "nome": "Camarão refogado com arroz",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a3",
        "gramas": 80.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a94",
        "gramas": 3.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "peixe_frutos_do_mar"
    ]
  },
  {
    "id": "p56",
    "nome": "Frango grelhado com batata-doce (marmita fit)",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a14",
        "gramas": 120.0
      },
      {
        "alimentoId": "a52",
        "gramas": 120.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p57",
    "nome": "Shake proteico vegano de banana",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a72",
        "gramas": 120.0
      },
      {
        "alimentoId": "a133",
        "gramas": 200.0
      },
      {
        "alimentoId": "a132",
        "gramas": 20.0
      },
      {
        "alimentoId": "a50",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "soja"
    ]
  },
  {
    "id": "p58",
    "nome": "Vitamina de banana com bebida de soja e aveia",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a72",
        "gramas": 100.0
      },
      {
        "alimentoId": "a133",
        "gramas": 200.0
      },
      {
        "alimentoId": "a50",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "soja"
    ]
  },
  {
    "id": "p59",
    "nome": "Aveia com bebida de soja e manga",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a50",
        "gramas": 40.0
      },
      {
        "alimentoId": "a133",
        "gramas": 150.0
      },
      {
        "alimentoId": "a80",
        "gramas": 80.0
      }
    ],
    "contemAlergenos": [
      "soja"
    ]
  },
  {
    "id": "p60",
    "nome": "Tofu mexido com legumes",
    "refeicoes": [
      "cafe",
      "almoco"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a47",
        "gramas": 150.0
      },
      {
        "alimentoId": "a111",
        "gramas": 40.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a107",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "soja"
    ]
  },
  {
    "id": "p61",
    "nome": "Arroz, feijão rajado e couve",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a129",
        "gramas": 130.0
      },
      {
        "alimentoId": "a103",
        "gramas": 40.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p62",
    "nome": "Arroz integral, feijão jalo e abóbora",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a48",
        "gramas": 100.0
      },
      {
        "alimentoId": "a128",
        "gramas": 130.0
      },
      {
        "alimentoId": "a91",
        "gramas": 60.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p63",
    "nome": "Arroz, feijão rosinha e cenoura",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a130",
        "gramas": 130.0
      },
      {
        "alimentoId": "a100",
        "gramas": 50.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p64",
    "nome": "Salada de feijão jalo com tomate e cebola",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a128",
        "gramas": 130.0
      },
      {
        "alimentoId": "a111",
        "gramas": 50.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a107",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p65",
    "nome": "Ervilha refogada com arroz e cenoura",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a126",
        "gramas": 120.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a100",
        "gramas": 40.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p66",
    "nome": "Yakisoba vegano com broto de feijão",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a59",
        "gramas": 100.0
      },
      {
        "alimentoId": "a163",
        "gramas": 60.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a100",
        "gramas": 30.0
      },
      {
        "alimentoId": "a107",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 8.0
      }
    ],
    "contemAlergenos": [
      "gluten"
    ]
  },
  {
    "id": "p67",
    "nome": "Pão de soja com pasta de amendoim e banana",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a144",
        "gramas": 60.0
      },
      {
        "alimentoId": "a113",
        "gramas": 20.0
      },
      {
        "alimentoId": "a72",
        "gramas": 60.0
      }
    ],
    "contemAlergenos": [
      "amendoim",
      "gluten",
      "soja"
    ]
  },
  {
    "id": "p68",
    "nome": "Bowl de frutas tropicais (mamão, jaca e água de coco)",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a79",
        "gramas": 120.0
      },
      {
        "alimentoId": "a170",
        "gramas": 60.0
      },
      {
        "alimentoId": "a153",
        "gramas": 150.0
      }
    ],
    "contemAlergenos": [
      "coco"
    ]
  },
  {
    "id": "p69",
    "nome": "Salada de frutas (romã, pitanga e graviola)",
    "refeicoes": [
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a177",
        "gramas": 60.0
      },
      {
        "alimentoId": "a176",
        "gramas": 60.0
      },
      {
        "alimentoId": "a168",
        "gramas": 80.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p70",
    "nome": "Escondidinho vegano de mandioca com feijão jalo",
    "refeicoes": [
      "jantar"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a60",
        "gramas": 150.0
      },
      {
        "alimentoId": "a128",
        "gramas": 100.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": []
  },
  {
    "id": "p71",
    "nome": "Salada de folhas com tofu e gergelim",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "vegano",
    "itens": [
      {
        "alimentoId": "a93",
        "gramas": 30.0
      },
      {
        "alimentoId": "a110",
        "gramas": 20.0
      },
      {
        "alimentoId": "a111",
        "gramas": 40.0
      },
      {
        "alimentoId": "a47",
        "gramas": 100.0
      },
      {
        "alimentoId": "a119",
        "gramas": 8.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "gergelim",
      "soja"
    ]
  },
  {
    "id": "p72",
    "nome": "Sanduíche de queijo pasteurizado no pão integral",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a66",
        "gramas": 50.0
      },
      {
        "alimentoId": "a149",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p73",
    "nome": "Pão francês com queijo minas meia cura",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a67",
        "gramas": 50.0
      },
      {
        "alimentoId": "a148",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p74",
    "nome": "Torrada com requeijão e tomate",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a146",
        "gramas": 30.0
      },
      {
        "alimentoId": "a38",
        "gramas": 20.0
      },
      {
        "alimentoId": "a111",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p75",
    "nome": "Cream cracker com queijo prato e tomate",
    "refeicoes": [
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a139",
        "gramas": 30.0
      },
      {
        "alimentoId": "a37",
        "gramas": 20.0
      },
      {
        "alimentoId": "a111",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p76",
    "nome": "Iogurte com cereal de milho e morango",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a29",
        "gramas": 150.0
      },
      {
        "alimentoId": "a140",
        "gramas": 30.0
      },
      {
        "alimentoId": "a85",
        "gramas": 50.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p77",
    "nome": "Omelete com queijo prato",
    "refeicoes": [
      "cafe",
      "almoco"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a18",
        "gramas": 100.0
      },
      {
        "alimentoId": "a37",
        "gramas": 30.0
      },
      {
        "alimentoId": "a111",
        "gramas": 30.0
      },
      {
        "alimentoId": "a98",
        "gramas": 10.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p78",
    "nome": "Risoto de legumes com queijo pasteurizado",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 120.0
      },
      {
        "alimentoId": "a149",
        "gramas": 25.0
      },
      {
        "alimentoId": "a90",
        "gramas": 40.0
      },
      {
        "alimentoId": "a100",
        "gramas": 30.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p79",
    "nome": "Panqueca de espinafre com ricota",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a57",
        "gramas": 30.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a32",
        "gramas": 60.0
      },
      {
        "alimentoId": "a105",
        "gramas": 40.0
      },
      {
        "alimentoId": "a39",
        "gramas": 40.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p80",
    "nome": "Vitamina de manga com leite e aveia",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a80",
        "gramas": 100.0
      },
      {
        "alimentoId": "a32",
        "gramas": 200.0
      },
      {
        "alimentoId": "a50",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p81",
    "nome": "Sanduíche de ovo com requeijão no pão integral",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a66",
        "gramas": 50.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a38",
        "gramas": 15.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p82",
    "nome": "Arroz, feijão e omelete de queijo",
    "refeicoes": [
      "almoco"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 100.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      },
      {
        "alimentoId": "a34",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p83",
    "nome": "Panqueca fit de banana com aveia e ovo",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "vegetariano",
    "itens": [
      {
        "alimentoId": "a72",
        "gramas": 80.0
      },
      {
        "alimentoId": "a50",
        "gramas": 40.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      }
    ],
    "contemAlergenos": [
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p84",
    "nome": "Sanduíche de presunto e queijo no pão integral",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a66",
        "gramas": 50.0
      },
      {
        "alimentoId": "a151",
        "gramas": 30.0
      },
      {
        "alimentoId": "a37",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p85",
    "nome": "Pão francês com presunto e ovo",
    "refeicoes": [
      "cafe"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a67",
        "gramas": 50.0
      },
      {
        "alimentoId": "a151",
        "gramas": 30.0
      },
      {
        "alimentoId": "a18",
        "gramas": 50.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p86",
    "nome": "Torrada com peito de peru e queijo",
    "refeicoes": [
      "cafe",
      "lanche"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a146",
        "gramas": 30.0
      },
      {
        "alimentoId": "a20",
        "gramas": 40.0
      },
      {
        "alimentoId": "a149",
        "gramas": 15.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p87",
    "nome": "Hambúrguer bovino com pão e salada",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a67",
        "gramas": 50.0
      },
      {
        "alimentoId": "a154",
        "gramas": 90.0
      },
      {
        "alimentoId": "a93",
        "gramas": 20.0
      },
      {
        "alimentoId": "a111",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "origem_animal"
    ]
  },
  {
    "id": "p88",
    "nome": "Linguiça de frango com arroz e vinagrete",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a155",
        "gramas": 80.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a111",
        "gramas": 30.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "origem_animal"
    ]
  },
  {
    "id": "p89",
    "nome": "Feijoada leve (feijão preto com linguiça e arroz)",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a43",
        "gramas": 130.0
      },
      {
        "alimentoId": "a156",
        "gramas": 60.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a103",
        "gramas": 30.0
      }
    ],
    "contemAlergenos": [
      "origem_animal"
    ]
  },
  {
    "id": "p90",
    "nome": "Costela de porco assada com mandioca",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a158",
        "gramas": 100.0
      },
      {
        "alimentoId": "a60",
        "gramas": 150.0
      },
      {
        "alimentoId": "a98",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "origem_animal"
    ]
  },
  {
    "id": "p91",
    "nome": "Omelete com presunto e queijo",
    "refeicoes": [
      "cafe",
      "almoco"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a18",
        "gramas": 100.0
      },
      {
        "alimentoId": "a151",
        "gramas": 30.0
      },
      {
        "alimentoId": "a37",
        "gramas": 20.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal",
      "ovo"
    ]
  },
  {
    "id": "p92",
    "nome": "Salada com salame e queijo minas",
    "refeicoes": [
      "almoco",
      "lanche"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a93",
        "gramas": 30.0
      },
      {
        "alimentoId": "a111",
        "gramas": 40.0
      },
      {
        "alimentoId": "a152",
        "gramas": 30.0
      },
      {
        "alimentoId": "a34",
        "gramas": 30.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p93",
    "nome": "Mortadela com queijo no pão francês",
    "refeicoes": [
      "lanche"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a67",
        "gramas": 50.0
      },
      {
        "alimentoId": "a157",
        "gramas": 30.0
      },
      {
        "alimentoId": "a37",
        "gramas": 15.0
      }
    ],
    "contemAlergenos": [
      "gluten",
      "lactose",
      "origem_animal"
    ]
  },
  {
    "id": "p94",
    "nome": "Arroz, feijão e linguiça de porco",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a41",
        "gramas": 100.0
      },
      {
        "alimentoId": "a156",
        "gramas": 60.0
      }
    ],
    "contemAlergenos": [
      "origem_animal"
    ]
  },
  {
    "id": "p95",
    "nome": "Frango grelhado com arroz e ervilha",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a13",
        "gramas": 120.0
      },
      {
        "alimentoId": "a49",
        "gramas": 100.0
      },
      {
        "alimentoId": "a126",
        "gramas": 60.0
      }
    ],
    "contemAlergenos": [
      "carne",
      "origem_animal"
    ]
  },
  {
    "id": "p96",
    "nome": "Merluza com purê de batata",
    "refeicoes": [
      "almoco",
      "jantar"
    ],
    "tipo": "onivoro",
    "itens": [
      {
        "alimentoId": "a16",
        "gramas": 120.0
      },
      {
        "alimentoId": "a53",
        "gramas": 150.0
      },
      {
        "alimentoId": "a32",
        "gramas": 30.0
      },
      {
        "alimentoId": "a115",
        "gramas": 5.0
      }
    ],
    "contemAlergenos": [
      "lactose",
      "origem_animal",
      "peixe_frutos_do_mar"
    ]
  }
];
