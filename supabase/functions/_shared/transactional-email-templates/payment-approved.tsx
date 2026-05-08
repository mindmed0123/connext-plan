/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Gestão de Obra'
const SITE_URL = 'https://gestaodeobra.online'

interface Props { name?: string; planName?: string; amount?: string }

const PaymentApprovedEmail = ({ name, planName, amount }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Pagamento aprovado — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pagamento confirmado</Heading>
        <Text style={text}>
          {name ? `Olá ${name}, seu` : 'Seu'} pagamento foi aprovado com sucesso
          {planName ? ` para o plano ${planName}` : ''}{amount ? ` no valor de ${amount}` : ''}.
        </Text>
        <Text style={text}>Sua assinatura está ativa e você já pode usar todos os recursos.</Text>
        <Button style={button} href={`${SITE_URL}/billing`}>Acessar minha conta</Button>
        <Text style={footer}>Obrigado por usar o {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentApprovedEmail,
  subject: 'Pagamento aprovado — Gestão de Obra',
  displayName: 'Pagamento aprovado',
  previewData: { name: 'João', planName: 'Pro Mensal', amount: 'R$ 97,00' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#525252', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
