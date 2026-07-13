# Svika Shona language model: training plan (work to be done)

**Status: roadmap, not built.** Today Svika ships English and Shona strings where the
Shona is a machine draft, and language parsing runs through a swappable LLM adapter. This
document is the honest, fact checked path to a purpose built Shona model that understands
modern Shona properly, trained on national compute. Nothing here is claimed as already
working. It is the plan and the evidence that the plan is sound.

Written 2026-07-13 from Mhofu's prototype notes (in `docs/Shona AI training/`), verified
against the current state of low resource machine translation research.

## 1. Why a purpose built Shona model, the gap is real

Shona is a recognised but low resource language: there is little clean modern written
parallel data to train on ([Right for Education, Shona and the linguistic data gap,
2026](https://rightforeducation.org/2026/02/23/shona-ai-and-the-linguistic-data-gap/)).
The main public English to Shona parallel corpus is JW300, a religious dataset, which is
where the archaic and biblical flavour in off the shelf Shona models comes from. Mhofu's
critique of the public data is correct and it is measurable: a Masakhane Shona model
trained on JW300 scored about 8.19 spBLEU on the FLORES benchmark, against 11.74 for the
larger M2M model ([Masakhane, Machine Translation for
Africa](https://arxiv.org/pdf/2003.11529), [FLORES benchmark](https://arxiv.org/pdf/2106.03193)).
Those are low scores. Generic translation also breaks on the register Svika actually needs:
modern, urban, technical and mixed language Shona. So proper Shona nuance is not something
an existing model hands you. It has to be built with clean, modern, curated data. That is
the work.

## 2. The base model and the token, the approach is sound

Two credible bases, and we should evaluate both rather than assume:

- **mBART-50** (`facebook/mbart-large-50`, about 611M parameters, 50 languages) is the base
  in the prototype. Shona is not in its vocabulary. The prototype's fix is the correct one:
  do not hijack the Afrikaans token `af_ZA`, because that forces Shona onto Afrikaans latent
  space and poisons the embeddings. Instead add a fresh `<sn_ZW>` token, resize the
  embedding matrix, and learn Shona from a clean vector. Extending the tokenizer and
  resizing embeddings is the documented, standard way to add a language
  ([mBART-50 model card](https://huggingface.co/facebook/mbart-large-50)).
- **NLLB-200** (Meta, No Language Left Behind, distilled 1.3B, 200 languages including 55
  African) already supports Shona and was built for exactly this low resource case
  ([The Register, 2022](https://www.theregister.com/2022/07/06/facebooks_new_translation_ai_breaks/)).
  It is worth testing as either a stronger base or as a teacher model for distillation into
  a smaller student. It may beat a from scratch mBART token add with less effort.

Recommendation: prototype the mBART `<sn_ZW>` route (already designed) and benchmark it
against NLLB-200 on the same held out set, then keep whichever wins. Both are valid; the
data decides.

## 3. Data engineering, the Golden Seed flywheel

The method in the notes is a published, effective technique for low resource translation,
not an improvisation. Synthetic parallel data from a seed, LLM generation, back translation
and sequence level knowledge distillation are all established ways to overcome data scarcity
([Scaling low resource MT via synthetic data with LLMs, 2025](https://arxiv.org/html/2505.14423v1)).
The pipeline:

1. **Golden Seed (human, paid).** A few hundred to a few thousand high fidelity modern
   parallel sentences across Svika's domains (transport, boarding, safety, wallet) and
   everyday life, authored and verified by paid Shona speakers. This is the quality anchor.
2. **Synthetic multiplication (Python + LLMs).** Feed the seed as few shot exemplars to open
   weight LLMs (Gemma, Mistral, Llama, Phi via Ollama in the prototype) to generate thousands
   of domain tagged rows. One caution the research is explicit about: filter the synthetic
   output for quality, since bad synthetic data hurts more than it helps. Add a validation or
   discriminator pass before a row enters training.
3. **Clean and dirty split.** Formal text plus deliberate street Shona, mixed language,
   typos and slang, so the model survives real world input.
4. **Shonglish transliteration lexicon.** Keep the prototype's rules for modern terms:
   prefix and verb ingestion (ku-treina, ku-pusha ku-Git) and descriptive hybrids with an
   English bracket for precision. Standard Shona has no native morphology for this register,
   so the lexicon is doing real linguistic work.

## 4. Sourcing the data with apps, the same move that got the kombi data

Svika already proves this pattern: a small purpose built app (the GPS logger) sourced the
real corridor data. The same move builds the Shona corpus. A lightweight open translation
app lets paid contributors translate and verify Golden Seed sentences with consent, growing
a clean modern Shona dataset that is itself a national asset the AI strategy openly wants to
exist. It is reusable far beyond Svika. Budget line: paid human translators for the seed and
the verification pass are the main cost, and worth sourcing funding for.

## 5. Compute and cost, verified and staged

- **Prototype on Kaggle, free.** About 30 GPU hours a week, a P100 (16GB) or two T4s (32GB
  combined), 12 hour sessions ([Kaggle GPU docs](https://www.kaggle.com/docs/efficient-gpu-usage)).
  A 611M model fits here only with the memory discipline the prototype already uses:
  gradient checkpointing, fp16 mixed precision, and micro batching (batch 4 by accumulation
  4 for an effective 16). That is the correct configuration for this hardware.
- **Scale on national compute.** Kaggle's weekly cap and 12 hour sessions are enough to
  prototype, not to train long and deep. Full training belongs on the Zimbabwe Centre for
  High Performance Computing (ZCHPC) at the University of Zimbabwe, a national cluster moving
  from 36 to over 300 teraflops that already serves 400 plus users
  ([TOP500](https://www.top500.org/news/zimbabwe-to-deploy-300-teraflop-supercomputer-from-inspur/),
  [zchpc.ac.zw](https://zchpc.ac.zw/aboutus)). This is exactly the national compute the
  challenge is built around, and using it is the point, not a nice to have.
- **Fallback.** If national compute access is delayed, rented cloud GPU covers a full run at
  a known dollar cost, so the plan is not blocked on any one provider.

## 6. Evaluation, honest and comparable

Evaluate on the FLORES-200 Shona (`sn_Latn`) held out set, which is professionally
translated, using BLEU, spBLEU and chrF++ through sacrebleu, the community standard
([FLORES / NLLB](https://arxiv.org/pdf/2106.03193)). Baselines to beat: the Masakhane JW300
model (about 8.19 spBLEU) and NLLB-200 on the same set. Report the numbers straight,
including where the model is still weak. A model that beats the public baselines on modern
register held out data is the honest proof, and it is the C3 dataset story a judge can check.

## 7. What it gives Svika, and beyond

It replaces the placeholder Shona with real nuance, it powers rider language understanding
in Shona for search and voice intents behind the existing swappable adapter, and the model
and the dataset are reusable across other Zimbabwean apps. It is Svika living the National
AI Strategy's call for local language models free from imported bias, and it is a national
Shona language asset that outlasts the app.

## 8. Milestones (work to be done)

1. Curate and pay for the Golden Seed across Svika's domains and everyday Shona.
2. Build the synthetic multiplication pipeline with a quality filter.
3. Prototype both bases (mBART `<sn_ZW>` and NLLB-200) on Kaggle, evaluate on FLORES-200.
4. Stand up the open translation app to crowd source and verify more seed data, paid and
   consented.
5. Train the winning approach long and deep on ZCHPC national compute.
6. Integrate behind Svika's language adapter, keeping the honesty tier accurate at every
   step: nothing ships as done until it is measured.

---

*This plan is roadmap. It maps to the proposal as one compact line in the CCE roadmap
(train the Shona model on ZCHPC national compute), one strategic alignment sentence, and a
dataset statement note. It is never presented as already built.*
