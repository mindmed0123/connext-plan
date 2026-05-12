/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Gestão de Obra'
const SITE_URL = 'https://gestaodeobra.online'

interface PlanoCheckout {
  nome: string
  preco: string
  url: string
  destaque?: boolean
}

interface Props {
  name?: string
  daysLeft?: number
  planos?: PlanoCheckout[]
}

const TrialReminderEmail = ({ name, daysLeft = 0, planos = [] }: Props) => {
  const isUrgent = daysLeft <= 3
  const headline =
    daysLeft === 0
      ? 'Seu período de teste termina hoje'
      : daysLeft === 1
      ? 'Falta 1 dia no seu período de teste'
      : `Faltam ${daysLeft} dias no seu período de teste`

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{headline} — escolha um plano e continue sem interrupção</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{headline}</Heading>
          <Text style={text}>
            {name ? `Olá ${name}, ` : 'Olá, '}
            esperamos que esteja aproveitando o {SITE_NAME} para gerenciar suas obras.
            {isUrgent
              ? ' Para não perder o acesso, escolha agora um dos planos abaixo:'
              : ' Quando estiver pronto, escolha um plano para continuar usando sem interrupção:'}
          </Text>

          {planos.map((p) => (
            <Section key={p.nome} style={p.destaque ? planoCardHighlight : planoCard}>
              <Text style={planoNome}>
                {p.nome} {p.destaque ? '· Mais popular' : ''}
              </Text>
              <Text style={planoPreco}>
                {p.preco} <span style={planoPeriodo}>/mês</span>
              </Text>
              <Button style={p.destaque ? buttonPrimary : buttonOutline} href={p.url}>
                Assinar {p.nome}
              </Button>
            </Section>
          ))}

          <Hr style={hr} />
          <Text style={footer}>
            Cancele quando quiser. Pagamentos processados com segurança.
          </Text>
          <Text style={footer}>
            Precisa de ajuda? Acesse <a href={SITE_URL} style={link}>{SITE_URL}</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TrialReminderEmail,
  subject: (data: Record<string, any>) => {
    const d = Number(data?.daysLeft ?? 0)
    if (d === 0) return `Seu trial do ${SITE_NAME} termina hoje`
    if (d === 1) return `Falta 1 dia no seu trial — ${SITE_NAME}`
    return `Faltam ${d} dias no seu trial — ${SITE_NAME}`
  },
  displayName: 'Lembrete de período de teste',
  previewData: {
    name: 'João',
    daysLeft: 7,
    planos: [
      { nome: 'Básico', preco: 'R$ 297,00', url: 'https://pay.cakto.com.br/szaqwp9' },
      { nome: 'Pro', preco: 'R$ 697,00', url: 'https://pay.cakto.com.br/dpjuzr2', destaque: true },
      { nome: 'Enterprise', preco: 'R$ 1.250,00', url: 'https://pay.cakto.com.br/rpyd2ck' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0F2448', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#525252', lineHeight: '1.6', margin: '0 0 20px' }
const planoCard = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px',
  margin: '0 0 12px',
}
const planoCardHighlight = {
  border: '2px solid #EE6616',
  borderRadius: '12px',
  padding: '16px',
  margin: '0 0 12px',
  backgroundColor: '#FFF7F0',
}
const planoNome = {
  fontSize: '12px',
  fontWeight: 'bold' as const,
  color: '#0F2448',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 4px',
}
const planoPreco = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0F2448', margin: '0 0 12px' }
const planoPeriodo = { fontSize: '12px', fontWeight: 'normal' as const, color: '#999' }
const buttonPrimary = {
  backgroundColor: '#EE6616',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '10px 18px',
  textDecoration: 'none',
  display: 'inline-block',
}
const buttonOutline = {
  backgroundColor: '#ffffff',
  color: '#0F2448',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '10px 18px',
  textDecoration: 'none',
  border: '1px solid #0F2448',
  display: 'inline-block',
}
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '8px 0' }
const link = { color: '#EE6616', textDecoration: 'underline' }
