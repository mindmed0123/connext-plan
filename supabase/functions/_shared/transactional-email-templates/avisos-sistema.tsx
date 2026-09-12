/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Item {
  titulo: string
  detalhe?: string
}

interface Grupo {
  titulo: string
  itens: Item[]
}

interface Props {
  empresaNome?: string
  periodo?: string
  grupos?: Grupo[]
}

const Email = ({ empresaNome, periodo, grupos = [] }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Resumo de prazos e novidades das suas obras`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Resumo das suas obras</Heading>
        <Text style={muted}>
          {empresaNome ? `${empresaNome} • ` : ''}
          {periodo ?? ''}
        </Text>
        {grupos.map((g) => (
          <Section key={g.titulo} style={section}>
            <Text style={h2}>{g.titulo}</Text>
            {g.itens.map((i, idx) => (
              <Text key={idx} style={item}>
                • {i.titulo}
                {i.detalhe ? ` — ${i.detalhe}` : ''}
              </Text>
            ))}
          </Section>
        ))}
        <Hr style={hr} />
        <Text style={muted}>
          Você recebe este resumo porque escolheu ser avisado nas preferências do sistema.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Resumo das obras${data?.empresaNome ? ` — ${data.empresaNome}` : ''}`,
  displayName: 'Resumo de avisos das obras',
  previewData: {
    empresaNome: 'Construtora Exemplo',
    periodo: '12/09/2026',
    grupos: [
      { titulo: 'Contas a vencer nos próximos 7 dias', itens: [{ titulo: 'Fornecedor X', detalhe: 'R$ 2.500,00 em 15/09' }] },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', margin: '0 0 4px', color: '#111827' }
const h2 = { fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: '#111827' }
const section = { margin: '18px 0 0' }
const item = { fontSize: '14px', margin: '0 0 4px', color: '#374151' }
const muted = { fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
