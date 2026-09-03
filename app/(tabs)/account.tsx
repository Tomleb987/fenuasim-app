import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { useUserData } from '../../hooks/useUserData'
import { supabase } from '../../lib/supabase'
import { useCurrency, CurrencyCode } from '../../lib/currency'
import dayjs from 'dayjs'

// Noms produits reels observes en base (product_type) -> libelle lisible.
// N'invente aucun produit : mappe seulement ce qui existe deja reellement.
const INSURANCE_PRODUCT_LABELS: Record<string, string> = {
  ava_carte_sante: 'Carte Santé',
  ava_tourist_card: 'Tourist Card',
  avantages_pom: 'AVAntages POM',
}

function humanizeInsuranceProduct(productType: string | null | undefined): string {
  if (!productType) return 'Assurance AVA'
  return INSURANCE_PRODUCT_LABELS[productType] ?? productType
}

export default function AccountScreen() {
  const router = useRouter()
  const { email, insurances, loading } = useUserData()
  const { currency, setCurrency } = useCurrency()
  const [fullName, setFullName] = useState<string | null>(null)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return
    const { data } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
    if (data?.full_name?.trim()) setFullName(data.full_name.trim())
  }

  function handleLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
        <View style={s.heroRow}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{(fullName ?? email) ? (fullName ?? email)![0].toUpperCase() : '?'}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={s.heroName}>{fullName ?? 'Mon compte'}</Text>
            <Text style={s.heroEmail}>{email ?? ''}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.secTitle}>Mon profil voyage</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.profileRow} onPress={() => router.push('/travelers')}>
            <View style={s.simIcon}>
              <Ionicons name="people-outline" size={20} color={COLORS.violet} />
            </View>
            <Text style={s.profileRowTxt}>Mes voyageurs</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={s.profileRow} onPress={() => router.push('/devices')}>
            <View style={s.simIcon}>
              <Ionicons name="phone-portrait-outline" size={20} color={COLORS.violet} />
            </View>
            <Text style={s.profileRowTxt}>Mes appareils</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.profileRow,{borderBottomWidth:0}]} onPress={() => router.push('/esim')}>
            <View style={s.simIcon}>
              <Ionicons name="hardware-chip-outline" size={20} color={COLORS.violet} />
            </View>
            <Text style={s.profileRowTxt}>Mes eSIM</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        <Text style={s.secTitle}>Mes services</Text>
        <View style={s.card}>
          <TouchableOpacity style={[s.profileRow, insurances.length === 0 && { borderBottomWidth: 0 }]} onPress={() => router.push('/insurance/form')}>
            <View style={s.shieldIcon}>
              <Ionicons name="shield-outline" size={20} color="#FD7F3C" />
            </View>
            <Text style={s.profileRowTxt}>Souscrire une assurance voyage</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          {loading ? (
            <View style={[s.profileRow,{borderBottomWidth:0}]}>
              <ActivityIndicator size="small" color={COLORS.violet} />
              <Text style={[s.profileRowTxt,{marginLeft:10}]}>Chargement de vos services...</Text>
            </View>
          ) : insurances.length > 0 && (
            <View style={[s.profileRow,{borderBottomWidth:0}]}>
              <View style={s.shieldIcon}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#FD7F3C" />
              </View>
              <Text style={s.profileRowTxt}>Mes assurances ({insurances.length})</Text>
            </View>
          )}
        </View>
        {insurances.map(o => (
          <View key={o.id} style={s.card}>
            <View style={s.cardHead}>
              <View style={s.shieldIcon}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#FD7F3C" />
              </View>
              <View style={{flex:1}}>
                <Text style={s.cardTitle}>{humanizeInsuranceProduct(o.product_type)}</Text>
                <Text style={s.cardSub}>
                  {o.start_date && o.end_date
                    ? dayjs(o.start_date).format('DD/MM/YYYY') + ' - ' + dayjs(o.end_date).format('DD/MM/YYYY')
                    : ''}
                </Text>
              </View>
              <View style={[s.pill, o.status === 'paid' ? s.pillActive : s.pillExpired]}>
                <Text style={[s.pillTxt, o.status === 'paid' ? s.pillActiveTxt : s.pillExpiredTxt]}>
                  {o.status === 'paid' ? 'Active' : o.status === 'pending_payment' ? 'En attente' : 'Inconnue'}
                </Text>
              </View>
            </View>
            {(() => {
              // contract_link est le champ reellement renseigne sur les contrats
              // existants (verifie en base) ; attestation_url_ava/certificate_url
              // ne le sont jamais actuellement mais sont conserves en repli au cas
              // ou ils seraient utilises plus tard.
              const docUrl = o.contract_link || o.attestation_url_ava || o.certificate_url
              return docUrl ? (
                <TouchableOpacity
                  style={s.installBtn}
                  onPress={() =>
                    Linking.openURL(docUrl).catch(() =>
                      Alert.alert('Erreur', "Impossible d'ouvrir le contrat, réessayez plus tard.")
                    )
                  }
                >
                  <Ionicons name="document-text-outline" size={15} color="#FD7F3C" />
                  <Text style={[s.installTxt, {color:'#FD7F3C'}]}>Voir le contrat</Text>
                </TouchableOpacity>
              ) : null
            })()}
          </View>
        ))}

        <TouchableOpacity style={s.newEsimCta} onPress={() => router.push('/(tabs)/explore')}>
          <View style={[s.actionIcon,{backgroundColor:'rgba(210,81,216,0.1)'}]}>
            <Ionicons name="hardware-chip-outline" size={20} color={COLORS.violet} />
          </View>
          <Text style={s.newEsimCtaTxt}>Acheter une nouvelle eSIM</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <Text style={s.secTitle}>Préférences</Text>
        <View style={s.card}>
          <View style={[s.profileRow,{borderBottomWidth:0}]}>
            <View style={s.simIcon}>
              <Ionicons name="pricetags-outline" size={20} color={COLORS.violet} />
            </View>
            <Text style={[s.profileRowTxt,{flex:1}]}>Devise d'affichage</Text>
            <View style={s.currencyToggle}>
              {(['XPF', 'EUR'] as CurrencyCode[]).map((c) => (
                <TouchableOpacity key={c} style={[s.currencyChip, currency === c && s.currencyChipSel]} onPress={() => setCurrency(c)}>
                  <Text style={[s.currencyChipTxt, currency === c && s.currencyChipTxtSel]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={s.secTitle}>Aide</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.profileRow} onPress={() => router.push('/support')}>
            <View style={s.simIcon}>
              <Ionicons name="headset-outline" size={20} color={COLORS.violet} />
            </View>
            <Text style={s.profileRowTxt}>Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.profileRow,{borderBottomWidth:0}]} onPress={handleLogout}>
            <View style={s.simIcon}>
              <Ionicons name="log-out-outline" size={20} color="#888" />
            </View>
            <Text style={s.profileRowTxt}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.secTitleMuted}>Gestion du compte</Text>
        <TouchableOpacity style={s.deleteAccountRow} onPress={() => router.push('/account/delete')}>
          <Text style={s.deleteAccountTxt}>Supprimer mon compte</Text>
        </TouchableOpacity>

        <View style={{height:30}} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  hero:{padding:20,paddingBottom:24},
  heroRow:{flexDirection:'row',alignItems:'center',gap:14},
  avatar:{width:52,height:52,borderRadius:26,backgroundColor:'rgba(255,255,255,0.25)',justifyContent:'center',alignItems:'center'},
  avatarTxt:{color:'#fff',fontSize:22,fontWeight:'800'},
  heroName:{color:'#fff',fontSize:16,fontWeight:'800'},
  heroEmail:{color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:2},
  scroll:{flex:1,padding:16},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text,marginBottom:12,marginTop:4},
  secTitleMuted:{fontSize:12,fontWeight:'700',color:'#bbb',textTransform:'uppercase',letterSpacing:0.3,marginBottom:8,marginTop:20},
  deleteAccountRow:{paddingVertical:10},
  deleteAccountTxt:{fontSize:13,fontWeight:'600',color:'#B00020'},
  card:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  profileRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  profileRowTxt:{flex:1,fontSize:14,fontWeight:'600',color:COLORS.text},
  currencyToggle:{flexDirection:'row',backgroundColor:COLORS.bg,borderRadius:10,padding:3,gap:2},
  currencyChip:{paddingHorizontal:12,paddingVertical:6,borderRadius:8},
  currencyChipSel:{backgroundColor:'#fff',shadowColor:'#000',shadowOpacity:0.08,shadowRadius:3,elevation:1},
  currencyChipTxt:{fontSize:12,fontWeight:'700',color:COLORS.textMuted},
  currencyChipTxtSel:{color:COLORS.violet},
  cardHead:{flexDirection:'row',alignItems:'center',gap:10},
  simIcon:{width:44,height:44,borderRadius:12,backgroundColor:'rgba(210,81,216,0.1)',justifyContent:'center',alignItems:'center'},
  shieldIcon:{width:44,height:44,borderRadius:12,backgroundColor:'rgba(253,127,60,0.1)',justifyContent:'center',alignItems:'center'},
  cardTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  cardSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  pill:{paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  pillTxt:{fontSize:11,fontWeight:'700'},
  pillActive:{backgroundColor:COLORS.successBg},
  pillActiveTxt:{color:COLORS.success},
  pillExpired:{backgroundColor:'#F0F0F0'},
  pillExpiredTxt:{color:COLORS.textMuted},
  installBtn:{flexDirection:'row',alignItems:'center',gap:6,marginTop:10,paddingTop:10,borderTopWidth:0.5,borderTopColor:'#f0f0f0'},
  installTxt:{color:COLORS.violet,fontSize:13,fontWeight:'600'},
  newEsimCta:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#fff',borderRadius:16,padding:14,marginBottom:16,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  newEsimCtaTxt:{flex:1,fontSize:14,fontWeight:'700',color:COLORS.text},
  actionIcon:{width:44,height:44,borderRadius:12,justifyContent:'center',alignItems:'center'},
})
