/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Gestão de Obra'
const SITE_URL = 'https://gestaodeobra.online'

interface Props { name?: string }

const PaymentFailedEmail = ({ name }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Não conseguimos processar seu pagamento</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pagamento não aprovado</Heading>
        <Text style={text}>
          {name ? `Olá ${name}, ` : 'Olá, '}não conseguimos processar a cobrança da sua assinatura
          {' '}do {SITE_NAME}.
        </Text>
        <Text style={text}>
          Para evitar a interrupção do acesso, atualize seu método de pagamento o quanto antes.
        </Text>
        <Button style={button} href={`${SITE_URL}/billing`}>Atualizar pagamento</Button>
        <Text style={footer}>Se precisar de ajuda, basta responder este e-mail.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentFailedEmail,
  subject: 'Pagamento não aprovado — ação necessária',
  displayName: 'Pagamento recusado',
  previewData: { name: 'João' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#b91c1c', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#525252', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
