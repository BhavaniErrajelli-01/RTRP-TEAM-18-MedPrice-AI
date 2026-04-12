import React from 'react';
import InfoPage from './InfoPage';

const sections = [
    {
        heading: 'What MedPrice is',
        body: 'MedPrice is a medicine price comparison project focused on helping people compare options more clearly without bouncing between multiple pharmacy tabs.',
    },
    {
        heading: 'What we are building',
        body: 'The product is moving beyond basic comparison toward saved medicines, refill support, smarter result pages, and a cleaner repeat-use experience.',
    },
    {
        heading: 'Why this matters',
        body: 'For recurring medicines, small price differences matter over time. Better comparison and faster navigation can reduce both friction and cost.',
    },
    {
        heading: 'How we want it to feel',
        body: 'The experience should be clean, direct, and trustworthy so users can understand the result quickly instead of fighting the interface.',
    },
];

const AboutUsPage = () => (
    <InfoPage
        eyebrow="About Us"
        title="About the MedPrice mission"
        description="MedPrice is being designed as a practical medicine comparison experience that helps users search faster, compare clearly, and return more confidently for repeat purchases."
        sections={sections}
    />
);

export default AboutUsPage;
