import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { buildWhatsappUrl } from '../../constants/support'
import { Linking } from 'react-native'

const ASSISTANT_API_URL = 'https://www.fenuasim.com/api/assistant'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// Le widget web (fenuasim.com) parle le "data stream protocol" du Vercel AI
// SDK : chaque ligne "0:"..."" est un fragment de texte a concatener (JSON
// pour gerer l'echappement), les lignes "f:"/"e:"/"d:" sont des metadonnees
// (debut/fin de step) qu'on ignore. Verifie avec un vrai appel a l'API.
function parseAssistantStream(raw: string): string {
  let text = ''
  for (const line of raw.split('\n')) {
    if (!line.startsWith('0:')) continue
    try {
      text += JSON.parse(line.slice(2))
    } catch {}
  }
  return text
}

// Le backend fenuasim.com genere parfois des liens en HTML brut (<a href="..."
// target="_blank" style="...">texte</a>), pense pour le widget web qui les
// injecte via dangerouslySetInnerHTML. React Native ne sait pas interpreter du
// HTML : sans ce parsing, la balise entiere (attributs compris) s'affichait
// telle quelle dans la bulle. On extrait les liens (HTML, markdown, ou URL
// nue) en segments texte/lien pour les rendre comme du <Text onPress=...>.
type MessageSegment = { text: string; url?: string }

function parseMessageSegments(raw: string): MessageSegment[] {
  const withAnchors: MessageSegment[] = []
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(raw))) {
    if (match.index > lastIndex) withAnchors.push({ text: raw.slice(lastIndex, match.index) })
    withAnchors.push({ text: match[2].replace(/<[^>]+>/g, ''), url: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < raw.length) withAnchors.push({ text: raw.slice(lastIndex) })

  const final: MessageSegment[] = []
  for (const seg of withAnchors) {
    if (seg.url) {
      final.push(seg)
      continue
    }
    // Balises restantes (gras, <br>, etc.) : on garde le texte, on jette le markup.
    const cleaned = seg.text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')

    let cursor = 0
    const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
    let mdMatch: RegExpExecArray | null
    const afterMd: MessageSegment[] = []
    while ((mdMatch = mdRegex.exec(cleaned))) {
      if (mdMatch.index > cursor) afterMd.push({ text: cleaned.slice(cursor, mdMatch.index) })
      afterMd.push({ text: mdMatch[1], url: mdMatch[2] })
      cursor = mdMatch.index + mdMatch[0].length
    }
    afterMd.push({ text: cleaned.slice(cursor) })

    for (const part of afterMd) {
      if (part.url) {
        final.push(part)
        continue
      }
      let urlCursor = 0
      const urlRegex = /(https?:\/\/[^\s]+)/g
      let urlMatch: RegExpExecArray | null
      while ((urlMatch = urlRegex.exec(part.text))) {
        if (urlMatch.index > urlCursor) final.push({ text: part.text.slice(urlCursor, urlMatch.index) })
        final.push({ text: urlMatch[1], url: urlMatch[1] })
        urlCursor = urlMatch.index + urlMatch[0].length
      }
      if (urlCursor < part.text.length) final.push({ text: part.text.slice(urlCursor) })
    }
  }
  return final.filter((s) => s.text !== '')
}

function FormattedMessage({ content, textStyle }: { content: string; textStyle: any }) {
  const segments = parseMessageSegments(content)
  return (
    <Text style={textStyle}>
      {segments.map((seg, i) =>
        seg.url ? (
          <Text key={i} style={s.link} onPress={() => Linking.openURL(seg.url!)}>
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        )
      )}
    </Text>
  )
}

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current

  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [])

  return (
    <View style={s.typingRow}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: COLORS.textMuted,
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }}
        />
      ))}
    </View>
  )
}

export default function SupportChatScreen() {
  const router = useRouter()
  const sessionId = useRef(`mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`).current
  const scrollRef = useRef<ScrollView>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setFailed(false)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setSending(true)
    try {
      const res = await fetch(ASSISTANT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, sessionId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.text()
      const reply = parseAssistantStream(raw)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply || "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?" }])
    } catch {
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={s.heroRow}>
            <View style={s.heroIcon}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </View>
            <View>
              <Text style={s.heroTitle}>Assistant IA</Text>
              <Text style={s.heroSub}>Réponses instantanées</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={[s.bubble, s.bubbleAssistant]}>
            <Text style={s.bubbleTxtAssistant}>
              Bonjour ! 👋 Je suis l'assistant FenuaSIM. Posez-moi vos questions sur l'activation, la
              consommation de données ou vos commandes.
            </Text>
          </View>

          {messages.map((m, i) => (
            <View key={i} style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}>
              {m.role === 'user' ? (
                <Text style={s.bubbleTxtUser}>{m.content}</Text>
              ) : (
                <FormattedMessage content={m.content} textStyle={s.bubbleTxtAssistant} />
              )}
            </View>
          ))}

          {sending && (
            <View style={[s.bubble, s.bubbleAssistant]}>
              <TypingDots />
            </View>
          )}

          {failed && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#B00020" />
              <Text style={s.errorTxt}>L'assistant est momentanément indisponible.</Text>
              <TouchableOpacity onPress={() => Linking.openURL(buildWhatsappUrl())}>
                <Text style={s.errorLink}>Contacter par WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Écrivez votre message..."
            placeholderTextColor={COLORS.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
            editable={!sending}
            multiline
          />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]} onPress={send} disabled={!input.trim() || sending}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 20 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12, marginBottom: 10 },
  bubbleAssistant: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  bubbleUser: { backgroundColor: COLORS.violet, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTxtAssistant: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  bubbleTxtUser: { fontSize: 14, color: '#fff', lineHeight: 20 },
  link: { color: COLORS.violet, fontWeight: '700', textDecorationLine: 'underline' },
  typingRow: { flexDirection: 'row', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  errorBox: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, backgroundColor: '#FDECEA', borderRadius: 12, padding: 12, marginTop: 4 },
  errorTxt: { fontSize: 12, color: '#B00020', flex: 1 },
  errorLink: { fontSize: 12, fontWeight: '700', color: COLORS.violet },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border },
  input: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.text, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.violet, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
})
