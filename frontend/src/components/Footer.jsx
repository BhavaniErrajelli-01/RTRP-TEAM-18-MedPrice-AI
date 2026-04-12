import React from 'react';

const footerColumns = [
    {
        title: 'MedPrice',
        links: ['About MedPrice', 'Privacy Policy', 'Terms & Conditions', 'Disclaimer'],
    },
    {
        title: 'Support',
        links: ['Email Us', 'How it works', 'Saved Drugs', 'Compare Drug Prices'],
    },
    {
        title: 'Press Center',
        links: ['Media Inquiries', 'Social', 'LinkedIn', 'Instagram'],
    },
];

const Footer = () => {
    return (
        <footer className="mt-12 border-t border-slate-300 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
                <div className="grid gap-8 md:grid-cols-3">
                    {footerColumns.map((column) => (
                        <div key={column.title}>
                            <h3 className="text-lg font-bold text-slate-950">{column.title}</h3>
                            <div className="mt-4 space-y-2">
                                {column.links.map((item) => (
                                    <div key={item} className="text-sm text-slate-700">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-10 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600">
                    <h4 className="font-bold text-slate-900">About MedPrice</h4>
                    <p className="mt-2">
                        MedPrice helps you compare medicine prices from top online pharmacies so you can quickly find the best deal before buying medicines online.
                    </p>
                    <p className="mt-4 text-xs text-slate-500">
                        MedPrice is for informational purposes only and does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before changing any medicine.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
