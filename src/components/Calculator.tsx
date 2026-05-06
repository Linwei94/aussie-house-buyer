'use client'

import { useMemo, useState } from 'react'
import InputPanel from '@/components/InputPanel'
import ResultPanel from '@/components/ResultPanel'
import {
  DEFAULT_INPUTS,
  calculateAll,
  type Inputs,
} from '@/lib/calculations'

interface Props {
  initialInputs?: Partial<Inputs>
}

export default function Calculator({ initialInputs }: Props = {}) {
  const [inputs, setInputs] = useState<Inputs>({
    ...DEFAULT_INPUTS,
    ...initialInputs,
    propertyData: {
      ...(DEFAULT_INPUTS.propertyData ?? {}),
      ...(initialInputs?.propertyData ?? {}),
    },
  })
  const result = useMemo(() => calculateAll(inputs), [inputs])

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[360px_1fr]">
      <div>
        <InputPanel inputs={inputs} onChange={setInputs} />
      </div>
      <div>
        <ResultPanel
          result={result}
          inputs={inputs}
          onInputsChange={setInputs}
        />
      </div>
    </div>
  )
}
