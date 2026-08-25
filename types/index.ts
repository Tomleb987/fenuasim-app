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

export type Traveler = {
  id: string
  user_id: string
  first_name: string
  last_name: string | null
  nickname: string | null
  is_account_holder: boolean
  created_at: string
  updated_at: string
}

export type Device = {
  id: string
  user_id: string
  traveler_id: string | null
  name: string
  brand: string | null
  model: string | null
  created_at: string
  updated_at: string
}

export type EsimAssignment = {
  id: string
  user_id: string
  airalo_order_id: string | null
  iccid: string
  traveler_id: string | null
  device_id: string | null
  label: string | null
  created_at: string
  updated_at: string
}

export type EsimTopupStatus = 'pending_payment' | 'paid' | 'processing' | 'completed' | 'failed'

export type EsimTopupOrder = {
  id: string
  user_id: string
  esim_assignment_id: string | null
  iccid: string
  package_id: string
  data_label: string | null
  amount: number
  currency: string
  stripe_session_id: string
  stripe_payment_intent: string | null
  status: EsimTopupStatus
  airalo_order_id: string | null
  retry_count: number
  last_error: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type EsimTopupOption = {
  package_id: string
  title: string | null
  data_label: string | null
  validity_days: number | null
  is_unlimited: boolean
  price_eur: number
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
