import { describe, expect, it } from 'vitest'

import { buildFlowJson, type FormField } from './forms'

describe('buildFlowJson', () => {
  it('uses a publishable Meta Flow JSON schema version', () => {
    const fields: FormField[] = [
      {
        id: 'email',
        type: 'email',
        label: 'Email',
        required: true,
      },
    ]

    expect(buildFlowJson('Lead form', fields)).toMatchObject({
      version: '7.0',
      screens: [
        {
          id: 'FORM',
          terminal: true,
          success: true,
        },
      ],
    })
  })
})
