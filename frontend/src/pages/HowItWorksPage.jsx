import React from 'react';
import InfoPage from './InfoPage';

const sections = [
    {
        heading: '1. Search a medicine',
        body: 'Type a branded medicine, generic salt, or common tablet variation. MedPrice prepares a comparison request and fills in helpful metadata where available.',
    },
    {
        heading: '2. Compare pharmacy prices',
        body: 'The app ranks the visible price options, highlights the best available deal, and keeps the buying flow focused on the result you need.',
    },
    {
        heading: '3. Open the pharmacy link',
        body: 'When you click Buy Now, MedPrice sends you to the pharmacy or a matching search page so you can continue the purchase there.',
    },
    {
        heading: '4. Save for later',
        body: 'You can save medicines, track repeat use, and build toward a stronger refill workflow instead of treating every search like a one-time action.',
    },
];

const HowItWorksPage = () => (
    <InfoPage
        eyebrow="How It Works"
        title="How MedPrice search and comparison works"
        description="The flow is designed to stay simple: search once, compare quickly, and move to the most useful pharmacy option."
        sections={sections}
    />
);

export default HowItWorksPage;
