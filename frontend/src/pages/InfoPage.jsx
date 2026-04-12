import React from 'react';

const InfoPage = ({ eyebrow, title, description, sections = [] }) => (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
        <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_52%,#fff8ec_100%)] px-6 py-10 shadow-sm sm:px-8">
            <div className="max-w-3xl">
                <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                    {eyebrow}
                </div>
                <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
                <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">{description}</p>
            </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
            {sections.map((section) => (
                <article key={section.heading} className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-900">{section.heading}</h2>
                    <p className="mt-3 text-base leading-7 text-slate-600">{section.body}</p>
                </article>
            ))}
        </section>
    </div>
);

export default InfoPage;
