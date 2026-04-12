import React from 'react';

const faqItems = [
    {
        question: 'Does MedPrice sell medicines directly?',
        answer: 'No. MedPrice is a comparison experience. It helps you compare visible options and then redirects you to the pharmacy to continue the purchase.',
    },
    {
        question: 'Can I search by brand name and salt name?',
        answer: 'Yes. You can use a branded medicine name, a salt name, or common dosage variants depending on what you know.',
    },
    {
        question: 'Why do some results use fallback data?',
        answer: 'If a live backend source is unavailable or slow, MedPrice can show fallback comparison data so the interface still works instead of failing completely.',
    },
    {
        question: 'Can I save medicines for later?',
        answer: 'Yes. The project already includes saved-drug and refill-oriented flows that can be expanded further as the product matures.',
    },
];

const FaqPage = () => (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
        <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_52%,#fff8ec_100%)] px-6 py-10 shadow-sm sm:px-8">
            <div className="max-w-3xl">
                <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
                    FAQ
                </div>
                <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Frequently asked questions</h1>
                <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                    Quick answers to the common questions around MedPrice search, comparison, redirect behavior, and saved medicine features.
                </p>
            </div>
        </section>

        <section className="space-y-4">
            {faqItems.map((item) => (
                <article key={item.question} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900">{item.question}</h2>
                    <p className="mt-3 text-base leading-7 text-slate-600">{item.answer}</p>
                </article>
            ))}
        </section>
    </div>
);

export default FaqPage;
