export const UNIVERSITIES = ['UCR', 'TEC', 'UNA', 'UNED', 'UTN', 'INA']

export const COSTA_RICA_PROVINCES = [
  'San José',
  'Alajuela',
  'Cartago',
  'Heredia',
  'Guanacaste',
  'Puntarenas',
  'Limón',
]

export const USER_TYPES = [
  {
    value: 'student',
    label: 'Estudiante',
  },
  {
    value: 'staff',
    label: 'Funcionario',
  },
] as const

export type UserType = (typeof USER_TYPES)[number]['value']