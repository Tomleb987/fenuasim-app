export type EsimOrder = {
  id: string
  user_id: string
  destination: string
  package_id: string
  data_gb: number | null
  duration_days: number
  price_xpf: number
  price_eur: number
  status: 'pending' | 'active' | 'expired'
  airalo_iccid: string | null
  qr_code_url: string | null
  activation_link: string | null
  stripe_payment_id: string | null
  expires_at: string | null
  created_at: string
}

export type InsuranceOrder = {
  id: string
  user_id: string
  destination: string
  departure_date: string
  return_date: string
  nb_travelers: number
  formula: 'essentiel' | 'confort' | 'globe_premium'
  price_xpf: number
  price_eur: number
  ava_contract_number: string | null
  attestation_url: string | null
  stripe_payment_id: string | null
  status: 'pending' | 'active' | 'cancelled'
  created_at: string
}

export type AiraloPackage = {
  id: string
  destination: string
  country_code: string
  data_gb: number | null
  duration_days: number
  price_eur: number
  price_xpf: number
  network: '4G' | '5G' | '4G LTE'
}

export type AvaFormula = 'essentiel' | 'confort' | 'globe_premium'

export type AvaQuote = {
  formula: AvaFormula
  label: string
  description: string
  price_eur: number
  price_xpf: number
  option_id: string
}
