/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Gestão de Obra'
const SITE_URL = 'https://gestaodeobra.online'

interface Props { name?: string }

const SubscriptionCanceledEmail = ({ name }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua assinatura foi cancelada</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Assinatura cancelada</Heading>
        <Text style={text}>
          {name ? `Olá ${name}, sua` : 'Sua'} assinatura do {SITE_NAME} foi cancelada.
          Você ainda pode usar o sistema até o fim do período já pago.
        </Text>
        <Text style={text}>Mudou de ideia? Você pode reativar a qualquer momento.</Text>
        <Button style={button} href={`${SITE_URL}/billing`}>Reativar assinatura</Button>
        <Text style={footer}>Sentiremos sua falta. Obrigado por ter usado o {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionCanceledEmail,
  subject: 'Assinatura cancelada — Gestão de Obra',
  displayName: 'Assinatura cancelada',
  previewData: { name: 'João' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#525252', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
