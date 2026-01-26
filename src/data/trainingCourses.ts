export interface Question {
  id: string;
  text: string;
  options: {
    value: string;
    label: string;
  }[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  duration: string;
  content: {
    section: string;
    items: string[];
  }[];
  exam: Question[];
}

export const trainingCourses: Course[] = [
  {
    id: 'roofing-basics',
    title: 'Roofing Basics',
    description: 'Learn the fundamentals of roofing systems, materials, and installation processes.',
    icon: '🏠',
    duration: '30 minutes',
    content: [
      {
        section: 'Introduction to Roofing',
        items: [
          'Understanding the purpose and importance of roofing systems',
          'Overview of residential and commercial roofing',
          'Key components: shingles, underlayment, flashing, ventilation',
          'Common roofing terminology and technical terms',
        ],
      },
      {
        section: 'Roofing Materials',
        items: [
          'Asphalt shingles - the most common residential roofing material',
          'Metal roofing - durability and energy efficiency',
          'Tile roofing - aesthetic appeal and longevity',
          'Flat roofing systems - TPO, EPDM, and modified bitumen',
          'Underlayment types: felt, synthetic, ice and water shield',
        ],
      },
      {
        section: 'Installation Process',
        items: [
          'Step 1: Roof inspection and preparation',
          'Step 2: Installing underlayment and ice/water shield',
          'Step 3: Installing drip edge and starter strips',
          'Step 4: Laying shingles with proper overlap',
          'Step 5: Installing ridge cap and ventilation',
          'Step 6: Final inspection and cleanup',
        ],
      },
      {
        section: 'Roof Lifespan & Maintenance',
        items: [
          'Typical lifespan: Asphalt 20-30 years, Metal 40-70 years, Tile 50+ years',
          'Regular inspection schedule (twice yearly)',
          'Common issues: missing shingles, leaks, granule loss',
          'Preventive maintenance tips for homeowners',
          'When to recommend repair vs. replacement',
        ],
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What is the most common residential roofing material?',
        options: [
          { value: 'a', label: 'Metal roofing' },
          { value: 'b', label: 'Asphalt shingles' },
          { value: 'c', label: 'Tile roofing' },
          { value: 'd', label: 'Slate' },
        ],
      },
      {
        id: 'q2',
        text: 'Which underlayment provides the best protection in valleys and eaves?',
        options: [
          { value: 'a', label: 'Felt paper' },
          { value: 'b', label: 'Synthetic underlayment' },
          { value: 'c', label: 'Ice and water shield' },
          { value: 'd', label: 'None needed' },
        ],
      },
      {
        id: 'q3',
        text: 'What is the first priority when starting a roofing project?',
        options: [
          { value: 'a', label: 'Safety first - proper equipment and fall protection' },
          { value: 'b', label: 'Speed - get it done quickly' },
          { value: 'c', label: 'Cost - use cheapest materials' },
          { value: 'd', label: 'Aesthetics - make it look good' },
        ],
      },
      {
        id: 'q4',
        text: 'What is the typical lifespan of asphalt shingles?',
        options: [
          { value: 'a', label: '10-15 years' },
          { value: 'b', label: '20-30 years' },
          { value: 'c', label: '40-50 years' },
          { value: 'd', label: '60+ years' },
        ],
      },
      {
        id: 'q5',
        text: 'Which component is critical for preventing moisture buildup in the attic?',
        options: [
          { value: 'a', label: 'Extra shingles' },
          { value: 'b', label: 'Thicker underlayment' },
          { value: 'c', label: 'Proper ventilation' },
          { value: 'd', label: 'More insulation' },
        ],
      },
    ],
  },
  {
    id: 'sales-techniques',
    title: 'Sales Techniques',
    description: 'Master the art of roofing sales with proven techniques and best practices.',
    icon: '💼',
    duration: '45 minutes',
    content: [
      {
        section: 'Building Rapport',
        items: [
          'First impressions matter - professional appearance and demeanor',
          'Active listening - understanding customer needs and concerns',
          'Building trust through knowledge and honesty',
          'Establishing credibility with testimonials and references',
          'Creating a connection - finding common ground',
        ],
      },
      {
        section: 'Needs Assessment',
        items: [
          'Asking open-ended questions to understand pain points',
          'Identifying decision-makers and influencers',
          'Understanding budget constraints and timeline',
          'Assessing urgency - is there damage or just preventive?',
          'Documenting current roof condition with photos',
        ],
      },
      {
        section: 'Presentation Skills',
        items: [
          'Focus on benefits, not just features',
          'Use visual aids - before/after photos, samples',
          'Explain the value proposition clearly',
          'Address common objections proactively',
          'Demonstrate ROI - energy savings, home value increase',
          'Use storytelling to make your pitch memorable',
        ],
      },
      {
        section: 'Closing the Deal',
        items: [
          'Recognize buying signals - engagement, questions about next steps',
          'Ask for the sale directly and confidently',
          'Offer financing options to overcome price objections',
          'Create urgency with limited-time offers or seasonal discounts',
          'Handle objections with empathy and facts',
          'Get a commitment - signature, deposit, or scheduled follow-up',
        ],
      },
      {
        section: 'Follow-Up Best Practices',
        items: [
          'Follow up within 24-48 hours after initial meeting',
          'Send thank-you notes and additional information',
          'Stay in touch even if they\'re not ready to buy',
          'Build a pipeline of warm leads',
          'Ask for referrals from satisfied customers',
        ],
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What is the best way to understand a customer\'s needs?',
        options: [
          { value: 'a', label: 'Tell them what they need' },
          { value: 'b', label: 'Ask open-ended questions and listen actively' },
          { value: 'c', label: 'Focus only on price' },
          { value: 'd', label: 'Push for a quick decision' },
        ],
      },
      {
        id: 'q2',
        text: 'How should you handle customer objections?',
        options: [
          { value: 'a', label: 'Ignore them and move on' },
          { value: 'b', label: 'Argue with the customer' },
          { value: 'c', label: 'Address concerns with empathy and facts' },
          { value: 'd', label: 'Give up immediately' },
        ],
      },
      {
        id: 'q3',
        text: 'When presenting a roofing solution, what should you do first?',
        options: [
          { value: 'a', label: 'Build rapport and establish trust' },
          { value: 'b', label: 'Talk about price immediately' },
          { value: 'c', label: 'List all technical specifications' },
          { value: 'd', label: 'Pressure them to decide now' },
        ],
      },
      {
        id: 'q4',
        text: 'What should you focus on when presenting to customers?',
        options: [
          { value: 'a', label: 'Technical features only' },
          { value: 'b', label: 'Benefits and value to the customer' },
          { value: 'c', label: 'Company history' },
          { value: 'd', label: 'Personal achievements' },
        ],
      },
      {
        id: 'q5',
        text: 'What is the key to successful follow-up?',
        options: [
          { value: 'a', label: 'Be consistent and timely' },
          { value: 'b', label: 'Wait for them to call you' },
          { value: 'c', label: 'Only follow up once' },
          { value: 'd', label: 'Send generic emails' },
        ],
      },
    ],
  },
  {
    id: 'safety-protocols',
    title: 'Safety Protocols',
    description: 'Essential safety guidelines and protocols for roofing work.',
    icon: '⚠️',
    duration: '30 minutes',
    content: [
      {
        section: 'Personal Protective Equipment (PPE)',
        items: [
          'Hard hats - protecting from falling objects',
          'Safety harnesses and fall protection systems',
          'Non-slip footwear with proper ankle support',
          'Safety glasses or goggles',
          'Gloves - cut-resistant and weather-appropriate',
          'High-visibility clothing for job site awareness',
        ],
      },
      {
        section: 'Fall Protection',
        items: [
          'Always use guardrails, safety nets, or personal fall arrest systems',
          'OSHA requires fall protection at 6 feet or higher',
          'Inspect all fall protection equipment before each use',
          'Anchor points must support 5,000 lbs per person',
          'Never work alone on a roof - always have a spotter',
          'Weather conditions - no work in rain, ice, or high winds',
        ],
      },
      {
        section: 'Ladder Safety',
        items: [
          'Inspect ladder before each use - no cracks or damage',
          'Set up on stable, level ground',
          'Ladder should extend 3 feet above the roof edge',
          'Maintain three points of contact when climbing',
          'Face the ladder when ascending or descending',
          'Never carry materials while climbing - use a hoist',
        ],
      },
      {
        section: 'Electrical Hazards',
        items: [
          'Stay at least 10 feet away from power lines',
          'Use non-conductive tools and ladders near electrical sources',
          'Be aware of overhead and underground utilities',
          'Never work on a wet roof near power lines',
          'Report any damaged electrical equipment immediately',
        ],
      },
      {
        section: 'Emergency Procedures',
        items: [
          'Know the location of first aid kits and fire extinguishers',
          'Have emergency contact numbers readily available',
          'Stop work immediately if unsafe conditions develop',
          'Report all accidents and near-misses',
          'Never remove safety equipment or guards',
          'Follow company emergency response protocols',
        ],
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What is the most important thing before starting any roofing work?',
        options: [
          { value: 'a', label: 'Always wear proper PPE and fall protection' },
          { value: 'b', label: 'Getting the job done quickly' },
          { value: 'c', label: 'Checking the weather forecast only' },
          { value: 'd', label: 'Bringing all your tools' },
        ],
      },
      {
        id: 'q2',
        text: 'Before using a ladder, what must you do?',
        options: [
          { value: 'a', label: 'Just start climbing' },
          { value: 'b', label: 'Check if it looks okay' },
          { value: 'c', label: 'Inspect it thoroughly for damage or defects' },
          { value: 'd', label: 'Ask someone else to check it' },
        ],
      },
      {
        id: 'q3',
        text: 'How many points of contact should you maintain when climbing a ladder?',
        options: [
          { value: 'a', label: 'One point' },
          { value: 'b', label: 'Three points of contact' },
          { value: 'c', label: 'Two points' },
          { value: 'd', label: 'No specific number' },
        ],
      },
      {
        id: 'q4',
        text: 'What should you do if unsafe conditions develop during work?',
        options: [
          { value: 'a', label: 'Stop work immediately and report it' },
          { value: 'b', label: 'Continue working carefully' },
          { value: 'c', label: 'Ignore it and finish the job' },
          { value: 'd', label: 'Wait until someone else notices' },
        ],
      },
      {
        id: 'q5',
        text: 'What standards govern workplace safety for roofing?',
        options: [
          { value: 'a', label: 'Company policies only' },
          { value: 'b', label: 'Personal judgment' },
          { value: 'c', label: 'OSHA safety standards and regulations' },
          { value: 'd', label: 'Customer preferences' },
        ],
      },
    ],
  },
];
