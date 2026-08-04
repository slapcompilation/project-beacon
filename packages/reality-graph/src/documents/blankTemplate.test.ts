import { describe, it, expect } from 'vitest'
import { detectBlankTemplate } from './blankTemplate'

// The real INV11122 chunk, verbatim from document_chunks. It reached
// `contextualized` and nothing noticed it was a form.
const INV11122 = `ΤΙΜΟΛΟΓΙΟ

Αριθμός Τιμολογίου: INV11122
Ημερομηνία Τιμολογίου: 1 Ιανουαρίου 2026
Ημερομηνία Λήξης: 30 Ιανουαρίου 2026

Από:
Όνομα
Επωνυμία
Διεύθυνση
Πόλη
Τ.Κ.

Χρέωση σε:
Όνομα
Επωνυμία
Διεύθυνση
Πόλη
Τ.Κ.

Περιγραφή | Ποσότητα | Τιμή μονάδας | Ποσό
Είδος 1 | 1 | €200.00 | €200.00
Είδος 2 | 2 | €500.00 | €1,000.00

Υποσύνολο: €1,200.00
ΦΠΑ: €0.00
Σύνολο: €1,200.00

Σημειώσεις:
Πληροφορίες πληρωμής:`

// A real invoice from the same supplier relationship would read like this.
const REAL_INVOICE = `ΤΙΜΟΛΟΓΙΟ

Αριθμός Τιμολογίου: 2026-0417
Ημερομηνία: 14 Ιανουαρίου 2026

Από:
ΗΛΙΑΚΤΙΔΑ Α.Ε.
Λεωφόρος Μυτιλήνης 42, Μυτιλήνη 81100
ΑΦΜ: 099123456

Χρέωση σε:
Valinor Hotel Operations
Μυτιλήνη-Λουτρά 81100

Περιγραφή | Ποσότητα | Τιμή μονάδας | Ποσό
Ψωμί ολικής 500g | 120 kg | €2.35 | €282.00
Κρουασάν βουτύρου | 80 kg | €4.10 | €328.00

Υποσύνολο: €610.00
ΦΠΑ 13%: €79.30
Σύνολο: €689.30`

describe('detectBlankTemplate', () => {
  it('flags the invoice that got all the way through the pipeline', () => {
    const v = detectBlankTemplate(INV11122)
    expect(v.isBlank).toBe(true)
    // Both of the signals a reader would give: the labels and the placeholders.
    expect(v.signals.join(' ')).toMatch(/placeholder line items/)
    expect(v.signals.join(' ')).toMatch(/nothing filled in/)
  })

  it('does not flag a filled-in invoice of the same shape', () => {
    const v = detectBlankTemplate(REAL_INVOICE)
    expect(v.isBlank).toBe(false)
    expect(v.score).toBeLessThan(0.5)
  })

  it('catches a form that says it is a form', () => {
    const v = detectBlankTemplate(
      'ΤΙΜΟΛΟΓΙΟ ΠΡΟΣΦΟΡΑΣ\n\nΓια συμπλήρωση από τον υποψήφιο προμηθευτή\n\n' +
      'Περιγραφή | Ποσότητα | Τιμή\nΕίδος 1 | | \nΕίδος 2 | | ',
    )
    expect(v.isBlank).toBe(true)
    expect(v.signals.join(' ')).toMatch(/instruction to complete/)
  })

  it('leaves ordinary prose alone', () => {
    const v = detectBlankTemplate(
      'Ο προμηθευτής υποχρεούται να παραδίδει τα προϊόντα εντός επτά ημερολογιακών ' +
      'ημερών από την παραγγελία. Η ελάχιστη αξία παραγγελίας ορίζεται σε 400 ευρώ.',
    )
    expect(v.isBlank).toBe(false)
    expect(v.signals).toHaveLength(0)
  })
})
