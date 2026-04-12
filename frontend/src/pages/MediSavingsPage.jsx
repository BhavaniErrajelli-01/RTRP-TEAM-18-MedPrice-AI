import React from 'react';
import InfoPage from './InfoPage';

const sections = [
    {
        heading: 'Why MedPrice saves time',
        body: 'Instead of opening several pharmacy sites one by one, MedPrice brings the visible options into one comparison flow so you can spot the better price faster.',
    },
    {
        heading: 'Why MedPrice saves money',
        body: 'The platform highlights lower-priced pharmacy options, substitute discovery, and saved-drug flows so repeat purchases become easier to manage.',
    },
    {
        heading: 'Built for repeat medicine buyers',
        body: 'MedPrice is especially useful for common recurring medicines where even small price differences add up across monthly refills.',
    },
    {
        heading: 'Simple and direct',
        body: 'The goal is not to overload the screen. It is to help you search, compare, and move to the right pharmacy with less friction.',
    },
];

const MediSavingsPage = () => (
    <InfoPage
        eyebrow="Medi Savings"
        title="A faster way to compare medicine prices"
        description="MedPrice helps you find lower visible prices across pharmacy sources and reach the best current option with fewer clicks."
        sections={sections}
    />
);

export default MediSavingsPage;
