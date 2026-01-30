// Training images
import roofTypesOverview from '@/assets/training/roof-types-overview.jpg';
import roofComponents from '@/assets/training/roof-components.jpg';
import shingleTypes from '@/assets/training/shingle-types.jpg';
import roofSheathing from '@/assets/training/roof-sheathing.jpg';
import roofVents from '@/assets/training/roof-vents.jpg';
import sidingComponents from '@/assets/training/siding-components.jpg';
import measuringDiagram from '@/assets/training/measuring-diagram.jpg';
import measuringFormulas from '@/assets/training/measuring-formulas.jpg';
import jobCycleOverview from '@/assets/training/job-cycle-overview.jpg';
import jobCycleSteps from '@/assets/training/job-cycle-steps.jpg';
import insuranceClaimExample from '@/assets/training/insurance-claim-example.jpg';
import d2dApproach from '@/assets/training/d2d-approach.jpg';

export interface Question {
  id: string;
  text: string;
  options: {
    value: string;
    label: string;
  }[];
}

export interface ContentItem {
  type: 'text' | 'highlight' | 'warning' | 'tip' | 'formula' | 'example' | 'script' | 'checklist';
  content: string;
  icon?: string;
}

export interface ContentSection {
  section: string;
  subtitle?: string;
  image?: string;
  imageCaption?: string;
  items: (string | ContentItem)[];
  keyTakeaway?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  duration: string;
  headerImage?: string;
  objectives?: string[];
  content: ContentSection[];
  exam: Question[];
}

export const trainingCourses: Course[] = [
  {
    id: 'titan-prime-standard',
    title: 'Titan Prime Standard',
    description: 'Required training on company values, professional conduct, and CRM responsibilities before gaining full access.',
    icon: '⚔️',
    duration: '20 minutes',
    objectives: [
      'Understand the Titan Prime brand values',
      'Learn professional conduct expectations',
      'Know CRM requirements and responsibilities',
      'Commit to the ownership culture',
    ],
    content: [
      {
        section: 'Welcome to Titan Prime Solutions',
        subtitle: 'Building a premium brand together',
        items: [
          { type: 'highlight', content: 'Titan Prime Solutions is a premium roofing and home improvement company built on professionalism, trust, and performance.' },
          'This is not a casual sales role — you represent a high-standard brand.',
          'Every interaction you have with homeowners, teammates, and partners reflects on Titan Prime Solutions.',
          { type: 'tip', content: 'Our expectation is simple: Act like a professional. Perform like a winner. Protect the brand.' },
        ],
        keyTakeaway: 'You are the face of Titan Prime. Make every interaction count.',
      },
      {
        section: 'The Titan Prime Standard',
        subtitle: 'Operating at a higher level',
        items: [
          'As a Titan Prime representative, you are expected to operate at a higher level than the average salesperson.',
          { type: 'checklist', content: 'Be punctual and reliable' },
          { type: 'checklist', content: 'Dress and present yourself professionally' },
          { type: 'checklist', content: 'Communicate clearly and respectfully' },
          { type: 'checklist', content: 'Follow through on commitments' },
          { type: 'checklist', content: 'Take responsibility for your results' },
          { type: 'checklist', content: 'Represent Titan Prime with integrity' },
          { type: 'highlight', content: 'If you wear the Titan Prime name, you carry the Titan Prime reputation.' },
        ],
        keyTakeaway: 'Excellence is not optional—it\'s the standard.',
      },
      {
        section: 'Customer Experience & Homeowner Conduct',
        subtitle: 'Building trust with every interaction',
        items: [
          { type: 'highlight', content: 'Homeowners trust us with one of their biggest assets — their home.' },
          { type: 'checklist', content: 'Speak respectfully and professionally' },
          { type: 'checklist', content: 'Never pressure or mislead a homeowner' },
          { type: 'checklist', content: 'Clearly explain pricing, timelines, and expectations' },
          { type: 'checklist', content: 'Keep properties clean and respected' },
          { type: 'checklist', content: 'Avoid confrontational or aggressive behavior' },
          { type: 'warning', content: 'Never argue with customers — escalate issues professionally' },
          { type: 'tip', content: 'Always leave a positive impression, even if a deal doesn\'t close.' },
        ],
        keyTakeaway: 'We sell trust, not just roofs.',
      },
      {
        section: 'Honesty, Ethics & Compliance',
        subtitle: 'Zero tolerance for unethical behavior',
        items: [
          { type: 'warning', content: 'Titan Prime Solutions operates with zero tolerance for unethical behavior.' },
          { type: 'warning', content: 'You may NOT: Lie to homeowners or partners' },
          { type: 'warning', content: 'You may NOT: Manipulate contracts or pricing' },
          { type: 'warning', content: 'You may NOT: Promise services or timelines you can\'t guarantee' },
          { type: 'warning', content: 'You may NOT: Use deceptive sales tactics' },
          { type: 'warning', content: 'You may NOT: Misrepresent insurance processes' },
          { type: 'warning', content: 'You may NOT: Engage in fraud or dishonest reporting' },
          { type: 'tip', content: 'If something feels questionable — don\'t do it. Protect the customer. Protect the company.' },
        ],
        keyTakeaway: 'Integrity is non-negotiable.',
      },
      {
        section: 'Professional Conduct & Behavior',
        subtitle: 'Protecting our culture and brand',
        items: [
          'To protect our culture and brand, the following behaviors are not acceptable:',
          { type: 'warning', content: 'Harassment or discrimination of any kind' },
          { type: 'warning', content: 'Substance use while working or at job sites' },
          { type: 'warning', content: 'Verbal or physical conflicts with teammates or customers' },
          { type: 'warning', content: 'Posting inappropriate content tied to Titan Prime on social media' },
          { type: 'warning', content: 'Gossip, drama, or disruptive behavior' },
          { type: 'warning', content: 'Damaging company relationships or reputation' },
          { type: 'highlight', content: 'Titan Prime is a professional organization — act like it.' },
        ],
        keyTakeaway: 'Professionalism at all times.',
      },
      {
        section: 'Accountability & Ownership Culture',
        subtitle: 'Ownership over excuses',
        items: [
          { type: 'highlight', content: 'At Titan Prime, we believe in ownership over excuses.' },
          { type: 'checklist', content: 'You are responsible for: Your performance' },
          { type: 'checklist', content: 'You are responsible for: Your communication with customers' },
          { type: 'checklist', content: 'You are responsible for: Your follow-ups' },
          { type: 'checklist', content: 'You are responsible for: Your paperwork and CRM accuracy' },
          { type: 'checklist', content: 'You are responsible for: Solving problems instead of blaming others' },
          { type: 'tip', content: 'Leaders take ownership. Excuses don\'t build careers here.' },
        ],
        keyTakeaway: 'Own your results, own your success.',
      },
      {
        section: 'Winning Mindset & Performance Expectations',
        subtitle: 'Building a high-performing team',
        items: [
          'Titan Prime is building a high-performing sales team.',
          { type: 'highlight', content: 'We value reps who are: Driven, Coachable, Competitive, Reliable, Focused on growth, Willing to learn and improve' },
          { type: 'warning', content: 'Average effort will not produce elite income.' },
          { type: 'tip', content: 'If you want to win, grow, and earn at a high level — you belong here.' },
        ],
        keyTakeaway: 'Elite performance = Elite income.',
      },
      {
        section: 'CRM & Operations Responsibility',
        subtitle: 'Before receiving full CRM access',
        items: [
          'Before receiving full CRM access, reps must:',
          { type: 'checklist', content: 'Submit a completed W-9' },
          { type: 'checklist', content: 'Use a company-approved work email' },
          { type: 'checklist', content: 'Complete onboarding training' },
          { type: 'checklist', content: 'Pass required quizzes and acknowledgments' },
          { type: 'highlight', content: 'CRM Rules:' },
          { type: 'checklist', content: 'Log all deals honestly and accurately' },
          { type: 'checklist', content: 'Do not falsify customer information' },
          { type: 'checklist', content: 'Keep customer data confidential' },
          { type: 'checklist', content: 'Follow company workflow processes' },
          { type: 'warning', content: 'The CRM is a business tool — misuse may result in termination.' },
        ],
        keyTakeaway: 'Accurate data = Better business.',
      },
      {
        section: 'Team Culture & Brand Identity',
        subtitle: 'More than a workplace',
        items: [
          { type: 'highlight', content: 'Titan Prime Solutions is not just a workplace — it\'s a team culture.' },
          'We are building a group of: Winners, Leaders, Professionals, High-earners, Long-term builders',
          'We support teammates, respect leadership, and represent the Titan Prime brand with pride.',
          { type: 'tip', content: 'You\'re not just selling — you\'re helping build a respected company.' },
        ],
        keyTakeaway: 'Build the company, build your legacy.',
      },
      {
        section: 'Commitment to the Titan Prime Standard',
        subtitle: 'Your agreement',
        items: [
          'By working with Titan Prime Solutions, you agree to:',
          { type: 'checklist', content: 'Uphold company values' },
          { type: 'checklist', content: 'Protect the brand\'s reputation' },
          { type: 'checklist', content: 'Operate with integrity and professionalism' },
          { type: 'checklist', content: 'Strive for growth and performance' },
          { type: 'checklist', content: 'Follow training, policies, and leadership direction' },
          { type: 'highlight', content: 'This is an opportunity to build a serious career — treat it seriously.' },
        ],
        keyTakeaway: 'Commit to excellence. Build your future.',
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What is the core expectation of a Titan Prime representative?',
        options: [
          { value: 'a', label: 'Close as many deals as possible by any means' },
          { value: 'b', label: 'Act like a professional, perform like a winner, protect the brand' },
          { value: 'c', label: 'Work only when convenient' },
          { value: 'd', label: 'Focus only on personal income' },
        ],
      },
      {
        id: 'q2',
        text: 'What should you do if a customer becomes confrontational?',
        options: [
          { value: 'a', label: 'Argue back to prove your point' },
          { value: 'b', label: 'Never argue — escalate issues professionally' },
          { value: 'c', label: 'Leave immediately without saying anything' },
          { value: 'd', label: 'Pressure them to sign anyway' },
        ],
      },
      {
        id: 'q3',
        text: 'Which of the following is NOT allowed under Titan Prime\'s ethics policy?',
        options: [
          { value: 'a', label: 'Clearly explaining timelines' },
          { value: 'b', label: 'Manipulating contracts or pricing' },
          { value: 'c', label: 'Following up with customers' },
          { value: 'd', label: 'Representing Titan Prime with integrity' },
        ],
      },
      {
        id: 'q4',
        text: 'What does "ownership culture" mean at Titan Prime?',
        options: [
          { value: 'a', label: 'Blaming others when things go wrong' },
          { value: 'b', label: 'Taking responsibility for your results and solving problems' },
          { value: 'c', label: 'Only doing what you\'re told' },
          { value: 'd', label: 'Waiting for someone else to fix issues' },
        ],
      },
      {
        id: 'q5',
        text: 'What must reps complete before receiving full CRM access?',
        options: [
          { value: 'a', label: 'Nothing — access is automatic' },
          { value: 'b', label: 'W-9, company email, onboarding training, and required quizzes' },
          { value: 'c', label: 'Only a phone call with management' },
          { value: 'd', label: 'Pay a deposit' },
        ],
      },
      {
        id: 'q6',
        text: 'What kind of reps does Titan Prime value?',
        options: [
          { value: 'a', label: 'Those who make excuses' },
          { value: 'b', label: 'Driven, coachable, competitive, reliable, and growth-focused' },
          { value: 'c', label: 'Those who avoid responsibility' },
          { value: 'd', label: 'Those who work only for minimum effort' },
        ],
      },
      {
        id: 'q7',
        text: 'What is prohibited professional conduct at Titan Prime?',
        options: [
          { value: 'a', label: 'Being punctual and reliable' },
          { value: 'b', label: 'Substance use while working or at job sites' },
          { value: 'c', label: 'Communicating clearly with customers' },
          { value: 'd', label: 'Following through on commitments' },
        ],
      },
      {
        id: 'q8',
        text: 'What does Titan Prime sell according to the training?',
        options: [
          { value: 'a', label: 'Only roofs' },
          { value: 'b', label: 'Trust, not just roofs' },
          { value: 'c', label: 'The cheapest option available' },
          { value: 'd', label: 'Whatever the customer wants to hear' },
        ],
      },
      {
        id: 'q9',
        text: 'What happens if you misuse the CRM system?',
        options: [
          { value: 'a', label: 'Nothing' },
          { value: 'b', label: 'Misuse may result in termination' },
          { value: 'c', label: 'You get a warning only' },
          { value: 'd', label: 'Your pay is reduced' },
        ],
      },
      {
        id: 'q10',
        text: 'By working with Titan Prime, you agree to:',
        options: [
          { value: 'a', label: 'Do whatever it takes to close deals' },
          { value: 'b', label: 'Uphold company values, protect the brand, and operate with integrity' },
          { value: 'c', label: 'Work only when it\'s convenient' },
          { value: 'd', label: 'Ignore training and policies' },
        ],
      },
    ],
  },
  {
    id: 'roof-types-components',
    title: 'Roof Types & Components',
    description: 'Learn roofing terminology, roof styles, and exterior components essential for inspections.',
    icon: '🏠',
    duration: '30 minutes',
    headerImage: roofTypesOverview,
    objectives: [
      'Master roofing terminology and measurements',
      'Identify different roof types and styles',
      'Understand roof components and their functions',
      'Learn waste calculation formulas',
    ],
    content: [
      {
        section: 'Essential Roofing Terms',
        subtitle: 'The language of roofing',
        image: roofTypesOverview,
        imageCaption: 'Common roof types and terminology overview',
        items: [
          { type: 'formula', content: '1 Square = 100 square feet (10\'x10\')' },
          { type: 'highlight', content: 'Actual: The actual number of squares on the roof (not including waste, starter, or ridge cap)' },
          { type: 'text', content: 'Rakes: Edges that slope at a diagonal on the roof (tip: gable ends)' },
          { type: 'text', content: 'Eaves: Run parallel to the ground on the roof (tip: where gutters hang)' },
          { type: 'tip', content: 'Think of EAVES = EVEN with ground. RAKES = at an angle like holding a rake.' },
        ],
        keyTakeaway: 'Master these terms—you\'ll use them every day.',
      },
      {
        section: 'Pitch, Valley & Ridge',
        subtitle: 'Understanding roof geometry',
        items: [
          { type: 'formula', content: 'Pitch: Expressed as X over 12 (rise over run). A 4/12 slope is mild, 10/12 is steep.' },
          { type: 'highlight', content: 'Valley: Where slopes of opposing directions meet to create a V shape' },
          { type: 'highlight', content: 'Ridge: Where slopes of opposing directions meet to create a peak (ridge cap covers these joints)' },
          { type: 'tip', content: 'Use a pitch gauge app on your phone to quickly measure roof slope!' },
        ],
        keyTakeaway: 'Valleys collect water, ridges shed water—know the difference.',
      },
      {
        section: 'Types of Flashing',
        subtitle: 'Protecting roof penetrations',
        items: [
          { type: 'highlight', content: 'Flashing: Metal protection preventing water from entering at penetrations' },
          { type: 'text', content: 'Counterflashing / Z-flashing / Roof-to-wall: Installed where roof meets a wall, runs left to right (not on a slope)' },
          { type: 'text', content: 'Step flashing: Installed where roof meets a wall on a diagonal (e.g., on the side of a dormer)' },
          { type: 'tip', content: 'Step flashing looks like stairs going up the roof line.' },
        ],
        keyTakeaway: 'Proper flashing prevents costly water damage.',
      },
      {
        section: 'Roof Styles',
        subtitle: 'Identifying different roof types',
        image: shingleTypes,
        imageCaption: 'Common roof styles and shingle types',
        items: [
          { type: 'highlight', content: 'Hip roof (envelope shape): Has slopes on all four sides' },
          { type: 'highlight', content: 'Gable roof (A-frame): Has two sloping sides that meet at a ridge' },
          { type: 'text', content: 'Gambrel/Mansard (barn style): Has two different slopes on each side' },
          { type: 'text', content: 'Flat: Typically uses "modified bitumen" material' },
          { type: 'tip', content: 'Hip roofs = 15% waste. Gable roofs = 10% waste.' },
        ],
        keyTakeaway: 'Roof style determines waste percentage.',
      },
      {
        section: 'Waste Calculation',
        subtitle: 'Accounting for material waste',
        items: [
          { type: 'formula', content: 'Gable roofs: Add 10% waste' },
          { type: 'formula', content: 'Hip roofs: Add 15% waste' },
          { type: 'example', content: 'Example: 30SQ gable × 10% = 3SQ waste → Total: 33 squares' },
          { type: 'example', content: 'Example: 30SQ hip × 15% = 4.5SQ waste → Total: 34.5 squares' },
        ],
        keyTakeaway: 'Always include waste in your calculations.',
      },
      {
        section: 'Exterior Roof Components',
        subtitle: 'What\'s on top of the roof',
        image: roofComponents,
        imageCaption: 'Roof layers and components diagram',
        items: [
          { type: 'text', content: 'Ridge / Ridge vent: At the peak of the roof for ventilation' },
          { type: 'text', content: 'Shingles ("field" shingles): Main roofing material covering the deck' },
          { type: 'text', content: 'Underlayment / felt: Protective layer under shingles' },
          { type: 'text', content: 'Decking: Plywood or OSB surface that shingles are nailed to' },
          { type: 'text', content: 'Ice & water shield / Weather guard: Extra protection in valleys and eaves' },
          { type: 'text', content: 'Fascia: Board along the eave edge' },
          { type: 'text', content: 'Drip edge: Metal edging at eaves and rakes' },
        ],
        keyTakeaway: 'Know each layer from deck to shingle.',
      },
      {
        section: 'Shingle Types',
        subtitle: '3-Tab vs. Architectural',
        image: shingleTypes,
        imageCaption: '3-Tab shingles (flat) vs Architectural shingles (3-dimensional)',
        items: [
          { type: 'highlight', content: '3-Tab Shingle: Flat appearance, looks like bricks - older style' },
          { type: 'highlight', content: 'Architectural Shingle: 3-dimensional, more modern appearance' },
          { type: 'text', content: 'Both are asphalt shingles — the most common roofing material' },
          { type: 'tip', content: 'Architectural shingles are thicker and more durable than 3-tab.' },
        ],
        keyTakeaway: 'Most homes today get architectural shingles.',
      },
      {
        section: 'Roof Penetrations & Vents',
        subtitle: 'Common roof features',
        image: roofVents,
        imageCaption: 'Types of roof vents and penetrations',
        items: [
          { type: 'text', content: 'Pipe jack (neoprene boot, 3-in-1): Covers plumbing vents' },
          { type: 'text', content: 'Lead pipe boot: Metal pipe covering' },
          { type: 'text', content: 'Chimney flashing: Waterproofing around chimney base' },
          { type: 'text', content: 'Chimney cricket: Diverts water around chimney' },
          { type: 'text', content: 'Turtle vent / box vent: Static ventilation' },
          { type: 'text', content: 'Ridge vent (Shingle over Style): Ventilation along ridge' },
          { type: 'text', content: 'Turbine vent / whirlybird: Spinning ventilation' },
          { type: 'text', content: 'Power attic fan: Electric ventilation' },
        ],
        keyTakeaway: 'Every penetration needs proper sealing.',
      },
      {
        section: 'Important Notes on Decking',
        subtitle: 'What insurance covers (and doesn\'t)',
        image: roofSheathing,
        imageCaption: 'Roof sheathing and structure diagram',
        items: [
          { type: 'warning', content: 'Insurance does NOT cover wood rot!' },
          { type: 'text', content: 'Decking/sheathing is only replaced locally where wood rot is found' },
          { type: 'tip', content: 'Rotten areas will feel very soft and spongy when you walk on them' },
          { type: 'text', content: 'Areas where leaks have historically been present may have rotted decking' },
          { type: 'text', content: 'Attic insulation is not affected and does not need to be replaced' },
        ],
        keyTakeaway: 'Always check for soft spots indicating rot.',
      },
      {
        section: 'Siding Components',
        subtitle: 'Exterior wall elements',
        image: sidingComponents,
        imageCaption: 'Siding components and terminology',
        items: [
          { type: 'text', content: 'J-channel: Trim around doors/windows' },
          { type: 'text', content: 'Fascia: Along eaves/rakes (6-8" usually)' },
          { type: 'text', content: 'Window wrap: Trim around windows' },
          { type: 'text', content: 'Soffit: Underneath eaves' },
          { type: 'text', content: 'Inside corner post: Interior corners' },
          { type: 'text', content: 'Outside corner post: Exterior corners' },
          { type: 'text', content: 'House wrap/moisture barrier: Behind siding' },
        ],
        keyTakeaway: 'Siding damage often accompanies roof damage.',
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What does "1 square" equal in roofing measurement?',
        options: [
          { value: 'a', label: '10 square feet' },
          { value: 'b', label: '100 square feet (10\'x10\')' },
          { value: 'c', label: '1000 square feet' },
          { value: 'd', label: '50 square feet' },
        ],
      },
      {
        id: 'q2',
        text: 'What is the proper waste percentage to use for a hip roof?',
        options: [
          { value: 'a', label: '5%' },
          { value: 'b', label: '10%' },
          { value: 'c', label: '15%' },
          { value: 'd', label: '20%' },
        ],
      },
      {
        id: 'q3',
        text: 'Where are "eaves" located on a roof?',
        options: [
          { value: 'a', label: 'At the peak where slopes meet' },
          { value: 'b', label: 'Running diagonally on gable ends' },
          { value: 'c', label: 'Running parallel to the ground where gutters hang' },
          { value: 'd', label: 'In the valleys between slopes' },
        ],
      },
      {
        id: 'q4',
        text: 'What type of flashing is installed where the roof meets a wall on a diagonal (like on the side of a dormer)?',
        options: [
          { value: 'a', label: 'Counterflashing' },
          { value: 'b', label: 'Z-flashing' },
          { value: 'c', label: 'Step flashing' },
          { value: 'd', label: 'Drip edge' },
        ],
      },
      {
        id: 'q5',
        text: 'Does insurance typically cover wood rot on decking?',
        options: [
          { value: 'a', label: 'Yes, always' },
          { value: 'b', label: 'No, insurance does NOT cover wood rot' },
          { value: 'c', label: 'Only if it is less than 2 years old' },
          { value: 'd', label: 'Only on hip roofs' },
        ],
      },
      {
        id: 'q6',
        text: 'What is the waste percentage for a gable roof?',
        options: [
          { value: 'a', label: '10%' },
          { value: 'b', label: '15%' },
          { value: 'c', label: '20%' },
          { value: 'd', label: '5%' },
        ],
      },
      {
        id: 'q7',
        text: 'What type of roof has an "envelope shape" with slopes on all four sides?',
        options: [
          { value: 'a', label: 'Gable roof' },
          { value: 'b', label: 'Hip roof' },
          { value: 'c', label: 'Gambrel roof' },
          { value: 'd', label: 'Flat roof' },
        ],
      },
      {
        id: 'q8',
        text: 'Where is a "valley" located on a roof?',
        options: [
          { value: 'a', label: 'At the peak where two slopes meet' },
          { value: 'b', label: 'Where slopes of opposing directions meet to create a V' },
          { value: 'c', label: 'Along the edge where gutters hang' },
          { value: 'd', label: 'Around chimney penetrations' },
        ],
      },
      {
        id: 'q9',
        text: 'What is the purpose of a "chimney cricket"?',
        options: [
          { value: 'a', label: 'To provide ventilation' },
          { value: 'b', label: 'To divert water around the chimney' },
          { value: 'c', label: 'To cover pipe penetrations' },
          { value: 'd', label: 'To cap the chimney flue' },
        ],
      },
      {
        id: 'q10',
        text: 'What is the difference between 3-Tab and Architectural shingles?',
        options: [
          { value: 'a', label: '3-Tab is thicker and more durable' },
          { value: 'b', label: 'Architectural shingles are flat like bricks' },
          { value: 'c', label: '3-Tab is flat, Architectural is 3-dimensional and more modern' },
          { value: 'd', label: 'They are the same thing with different names' },
        ],
      },
    ],
  },
  {
    id: 'measuring-estimating',
    title: 'Measuring & Estimating Roofs',
    description: 'Master the mathematical formulas and techniques for measuring roofs and siding.',
    icon: '📐',
    duration: '45 minutes',
    headerImage: measuringDiagram,
    objectives: [
      'Learn basic geometric formulas',
      'Master roof diagramming techniques',
      'Know when to measure vs. order reports',
      'Understand siding measurement',
    ],
    content: [
      {
        section: 'General Diagramming Rules',
        subtitle: 'Documentation standards',
        image: measuringDiagram,
        imageCaption: 'Example roof diagram with measurements',
        items: [
          { type: 'checklist', content: 'Write homeowner\'s last name and address in upper right corner of every diagram' },
          { type: 'checklist', content: 'Include orientation of the diagram (front, rear, right, left)' },
          { type: 'checklist', content: 'Document: Eaves, Rakes, Valleys, Ridges/Hips' },
          { type: 'tip', content: 'On hips, don\'t forget to measure the height of trapezoids (distance between base1 & base2)' },
        ],
        keyTakeaway: 'Proper documentation prevents costly mistakes.',
      },
      {
        section: 'Basic Mathematical Formulas',
        subtitle: 'The math you need to know',
        image: measuringFormulas,
        imageCaption: 'Roof measuring formulas reference',
        items: [
          { type: 'formula', content: 'Rectangle/Square: Length × Width' },
          { type: 'formula', content: 'Triangle: Base × Height ÷ 2' },
          { type: 'formula', content: 'Trapezoid (for hips): (Base1 + Base2) × Height ÷ 2' },
          { type: 'formula', content: 'Pythagorean Theorem: a² + b² = c²' },
          { type: 'highlight', content: 'Convert square feet to squares: Divide by 100' },
        ],
        keyTakeaway: 'These 4 formulas cover 95% of roof measuring.',
      },
      {
        section: 'Measurement Examples',
        subtitle: 'Putting formulas into practice',
        items: [
          { type: 'example', content: 'Rectangle: 30 × 18 = 540 sq ft = 5.4 squares' },
          { type: 'example', content: 'Trapezoid: (40 + 20) × 10 ÷ 2 = 300 sq ft = 3 squares' },
          { type: 'example', content: 'Triangle: 14 × 16 ÷ 2 = 112 sq ft = 1.12 squares' },
          { type: 'tip', content: 'Always divide complex areas into simpler shapes to calculate.' },
        ],
        keyTakeaway: 'Break complex roofs into simple shapes.',
      },
      {
        section: 'When to Measure vs. Order Reports',
        subtitle: 'Saving time and staying safe',
        items: [
          { type: 'highlight', content: 'If it takes less than 20 minutes to diagram and measure → do it yourself' },
          { type: 'highlight', content: 'For difficult, multi-steep, or 3+ story roofs → order an EagleView or RoofScope report' },
          { type: 'tip', content: 'Ordering a report saves time and can be safer than climbing complicated roofs.' },
          { type: 'warning', content: 'Safety first! Never risk injury for a measurement.' },
        ],
        keyTakeaway: 'Know when to DIY and when to order a report.',
      },
      {
        section: 'Measuring Siding',
        subtitle: 'Per-elevation calculations',
        items: [
          { type: 'text', content: 'Calculate measurements in squares or square feet PER elevation' },
          { type: 'text', content: 'Simplify by dividing elevations into simple shapes (rectangles and triangles)' },
          { type: 'formula', content: 'Formula: # of panels × panel height in inches ÷ 12 = height in feet' },
          { type: 'checklist', content: 'Measure the width of the elevation' },
          { type: 'checklist', content: 'Measure the height of siding panel in inches' },
          { type: 'checklist', content: 'Count the number of panels high per "shape"' },
        ],
        keyTakeaway: 'Siding is measured per wall elevation.',
      },
      {
        section: 'Estimating Checklist',
        subtitle: 'What to document for every estimate',
        items: [
          { type: 'checklist', content: 'Actual squares (total roof area)' },
          { type: 'checklist', content: 'Squares + waste (add 10% for gable, 15% for hip)' },
          { type: 'checklist', content: 'Eaves linear feet (LF)' },
          { type: 'checklist', content: 'Rakes linear feet (LF)' },
          { type: 'checklist', content: 'Ridge/hip linear feet (LF)' },
          { type: 'checklist', content: 'Valley linear feet (LF)' },
          { type: 'checklist', content: 'Style of roof (gable, hip, combination)' },
        ],
        keyTakeaway: 'Complete documentation = accurate estimate.',
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What is the formula for calculating the area of a trapezoid (used for hip sections)?',
        options: [
          { value: 'a', label: 'Length × Width' },
          { value: 'b', label: '(Base1 + Base2) × Height ÷ 2' },
          { value: 'c', label: 'Base × Height' },
          { value: 'd', label: 'π × radius²' },
        ],
      },
      {
        id: 'q2',
        text: 'How do you convert square feet to roofing squares?',
        options: [
          { value: 'a', label: 'Multiply by 100' },
          { value: 'b', label: 'Divide by 10' },
          { value: 'c', label: 'Divide by 100' },
          { value: 'd', label: 'Multiply by 10' },
        ],
      },
      {
        id: 'q3',
        text: 'When should you order an EagleView report instead of measuring yourself?',
        options: [
          { value: 'a', label: 'For every roof' },
          { value: 'b', label: 'Only for single-story homes' },
          { value: 'c', label: 'For difficult, multi-steep, or 3+ story roofs' },
          { value: 'd', label: 'Never, always measure yourself' },
        ],
      },
      {
        id: 'q4',
        text: 'What should you write in the upper right corner of every roof diagram?',
        options: [
          { value: 'a', label: 'Your company name' },
          { value: 'b', label: 'The date only' },
          { value: 'c', label: 'Homeowner\'s last name, address, and orientation' },
          { value: 'd', label: 'The roof pitch' },
        ],
      },
      {
        id: 'q5',
        text: 'A rectangle measuring 30 feet × 18 feet equals how many roofing squares?',
        options: [
          { value: 'a', label: '5.4 squares' },
          { value: 'b', label: '54 squares' },
          { value: 'c', label: '48 squares' },
          { value: 'd', label: '540 squares' },
        ],
      },
      {
        id: 'q6',
        text: 'What is the formula for calculating the area of a triangle?',
        options: [
          { value: 'a', label: 'Length × Width' },
          { value: 'b', label: 'Base × Height ÷ 2' },
          { value: 'c', label: '(Base1 + Base2) × Height' },
          { value: 'd', label: 'Side × Side × Side' },
        ],
      },
      {
        id: 'q7',
        text: 'Using the trapezoid formula, what is the area of a hip section with Base1=40ft, Base2=20ft, Height=10ft?',
        options: [
          { value: 'a', label: '600 square feet' },
          { value: 'b', label: '300 square feet' },
          { value: 'c', label: '400 square feet' },
          { value: 'd', label: '200 square feet' },
        ],
      },
      {
        id: 'q8',
        text: 'When measuring siding height, how do you calculate feet from panel count?',
        options: [
          { value: 'a', label: '# of panels × panel height in feet' },
          { value: 'b', label: '# of panels × panel height in inches ÷ 12' },
          { value: 'c', label: '# of panels ÷ 12' },
          { value: 'd', label: 'Panel height × 12' },
        ],
      },
      {
        id: 'q9',
        text: 'What should you document when measuring for an estimate?',
        options: [
          { value: 'a', label: 'Only the total square footage' },
          { value: 'b', label: 'Eaves LF, Rakes LF, Ridge/Hip LF, Valley LF, and style of roof' },
          { value: 'c', label: 'Just the pitch and square footage' },
          { value: 'd', label: 'Only what the homeowner tells you' },
        ],
      },
      {
        id: 'q10',
        text: 'If a roof takes less than 20 minutes to measure, what should you do?',
        options: [
          { value: 'a', label: 'Order an EagleView report anyway' },
          { value: 'b', label: 'Do it yourself' },
          { value: 'c', label: 'Skip the measurement' },
          { value: 'd', label: 'Have the homeowner measure it' },
        ],
      },
    ],
  },
  {
    id: 'sales-door-knocking',
    title: 'Sales & Door-to-Door Approach',
    description: 'Learn effective phone scripts, door knocking techniques, and how to handle objections.',
    icon: '🚪',
    duration: '45 minutes',
    headerImage: d2dApproach,
    objectives: [
      'Master the phone approach script',
      'Learn effective door knocking techniques',
      'Handle common objections with Feel-Felt-Found',
      'Set appointments like a pro',
    ],
    content: [
      {
        section: 'Phone Approach Script',
        subtitle: 'Getting the appointment by phone',
        items: [
          { type: 'script', content: '"Hey _____, this is (name). How\'s it going? Great! Well do you have a quick second or did I catch you at a bad time?"' },
          { type: 'script', content: '"The reason I\'m calling is I just started a new job here working for (company). I\'m helping out with taking care of homeowners in the area who were hit with that big hail storm."' },
          { type: 'script', content: '"For my first couple weeks, one of my assignments is to practice doing some inspections. My goal is to look at 10 roofs by Saturday."' },
          { type: 'script', content: '"Would you be nice enough to let me stop by and do a practice run with you? Would (day) at (time) or (time) work better for you?"' },
        ],
        keyTakeaway: 'Always offer two specific times to choose from.',
      },
      {
        section: 'Phone Firm Up Script',
        subtitle: 'Lock in the appointment',
        items: [
          { type: 'script', content: '"Can you do me a big favor? Let me know when to have a pen."' },
          { type: 'script', content: '"Can you write down that I\'ll be by on (day) at (time) on your calendar?"' },
          { type: 'script', content: '"Here\'s my phone number in case something pops up: ###-###-####"' },
          { type: 'script', content: '"What\'s your address again? Is your house 1 or 2 stories?"' },
          { type: 'tip', content: 'If it rains, I obviously can\'t get on the roof, so I\'ll call you if anything pops up.' },
        ],
        keyTakeaway: 'Get them to write it on their calendar!',
      },
      {
        section: 'Door Knocking Approach',
        subtitle: 'The initial conversation',
        image: d2dApproach,
        imageCaption: 'Door-to-door approach guide',
        items: [
          { type: 'script', content: '"Hey, how\'s it going? I\'m really sorry to bother you."' },
          { type: 'script', content: '"Do you by chance know (neighbor\'s name) who lives right over there? They\'re actually my (friend/uncle/coach)."' },
          { type: 'script', content: '"I just got done taking a look at their roof. They had me do an inspection because of that big hail storm."' },
          { type: 'script', content: '"I actually did find some hail damage up there, which isn\'t too surprising considering most cars in the area got dinged up."' },
          { type: 'script', content: '"I\'m going to be back out here on (day) and (day) to do a few more free inspections. Would (day) at (time) or (time) work better for you?"' },
        ],
        keyTakeaway: 'Reference a neighbor to build instant trust.',
      },
      {
        section: 'Explaining the Inspection',
        subtitle: 'How hail damage works',
        items: [
          { type: 'script', content: '"Basically what we\'ll do is hop up on the roof, take a look around and see if there\'s any bruising from the hail."' },
          { type: 'highlight', content: 'Hail leaves "bruises" which are soft spots on the shingles. It causes granules to loosen and erode, exposing asphalt to the sun.' },
          { type: 'script', content: '"It can take months or years, but eventually the sun chews a hole through and then you get leaks."' },
          { type: 'script', content: '"Insurance covers it if it\'s damaged. If there\'s no damage, we\'ll just let you know you\'re looking good."' },
        ],
        keyTakeaway: 'Explain the WHY behind the free inspection.',
      },
      {
        section: 'Handling Objections: Feel-Felt-Found',
        subtitle: 'The magic formula',
        items: [
          { type: 'highlight', content: 'Step 1: AGREE with their concern (never argue!)' },
          { type: 'highlight', content: 'Step 2: Say "I totally understand how you FEEL..."' },
          { type: 'highlight', content: 'Step 3: Share that others "FELT the same way..."' },
          { type: 'highlight', content: 'Step 4: Explain what they "FOUND" was beneficial' },
          { type: 'highlight', content: 'Step 5: Ask for two appointment times again' },
          { type: 'tip', content: 'This method works for almost ANY objection!' },
        ],
        keyTakeaway: 'Feel → Felt → Found → Ask for appointment',
      },
      {
        section: 'Common Objection: "I don\'t have any damage"',
        subtitle: 'How to respond',
        items: [
          { type: 'script', content: '"I totally understand, in fact a lot of people have felt the same way..."' },
          { type: 'script', content: '"Unlike wind damage which rips shingles off, hail damage is really hard to spot and doesn\'t leak for months or years."' },
          { type: 'script', content: '"What they found was it was better safe than sorry to get it checked out, just in case."' },
          { type: 'script', content: '"It\'s a free inspection. We\'re not going to tell you you need a new roof if you don\'t. Would (day) at (time) or (time) work better?"' },
        ],
        keyTakeaway: 'Hail damage is invisible—that\'s why inspection matters.',
      },
      {
        section: 'Common Objection: "My husband/neighbor already looked"',
        subtitle: 'Professional expertise matters',
        items: [
          { type: 'script', content: '"I totally understand, in fact one of your neighbors said the same thing."' },
          { type: 'script', content: '"But she had me take a look anyway because her husband is a dentist and admitted he didn\'t really know what he was looking for."' },
          { type: 'script', content: '"They were glad they had me take a look because they actually did have hail damage."' },
          { type: 'script', content: '"I ended up meeting with their insurance company who agreed to pay to replace their roof. Would Monday at (time) or (time) work better?"' },
        ],
        keyTakeaway: 'Professional eyes catch what others miss.',
      },
      {
        section: 'Scheduling Best Practices',
        subtitle: 'Setting yourself up for success',
        items: [
          { type: 'tip', content: 'Keep it simple and relaxed. Don\'t be salesy or over-the-top enthusiastic' },
          { type: 'warning', content: 'NEVER schedule more than 3-4 days in advance (too easy to forget)' },
          { type: 'highlight', content: 'ALWAYS offer TWO times (choices, not yes/no)' },
          { type: 'checklist', content: 'Make sure both husband & wife can be there' },
          { type: 'checklist', content: 'Schedule inspections 1.5-2 hours apart' },
          { type: 'warning', content: 'Do NOT do an inspection on the spot — setting appointment gives 2 impressions instead of 1' },
          { type: 'warning', content: 'Do NOT SELL on the phone/at the door — ONLY schedule inspections' },
        ],
        keyTakeaway: 'Your only goal at the door: schedule the appointment.',
      },
      {
        section: 'When They Still Say No',
        subtitle: 'Leave the door open',
        items: [
          { type: 'tip', content: 'Never take it personally! Leave on a good note.' },
          { type: 'script', content: '"No problem! I\'m going to be seeing several of your neighbors this week, so if you change your mind, just wave me over."' },
          { type: 'script', content: '"Here\'s my card if you want to give me a call! Have a good night."' },
          { type: 'highlight', content: 'Many people who initially declined later see neighbors getting new roofs and call back!' },
        ],
        keyTakeaway: 'A "no" today can become a "yes" tomorrow.',
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'When offering appointment times, what should you ALWAYS do?',
        options: [
          { value: 'a', label: 'Ask if they\'re available this week' },
          { value: 'b', label: 'Offer TWO specific times to choose from' },
          { value: 'c', label: 'Let them pick any time they want' },
          { value: 'd', label: 'Only offer one time slot' },
        ],
      },
      {
        id: 'q2',
        text: 'What is the "Feel-Felt-Found" method used for?',
        options: [
          { value: 'a', label: 'Measuring roofs' },
          { value: 'b', label: 'Handling customer objections' },
          { value: 'c', label: 'Filing insurance claims' },
          { value: 'd', label: 'Installing shingles' },
        ],
      },
      {
        id: 'q3',
        text: 'Why should you NOT do an inspection on the spot when door knocking?',
        options: [
          { value: 'a', label: 'It\'s against company policy' },
          { value: 'b', label: 'Setting an appointment gives you 2 impressions instead of 1, and avoids a yes/no question' },
          { value: 'c', label: 'You need special equipment' },
          { value: 'd', label: 'The homeowner won\'t trust you' },
        ],
      },
      {
        id: 'q4',
        text: 'How far in advance should you schedule inspections at most?',
        options: [
          { value: 'a', label: '1-2 weeks' },
          { value: 'b', label: '3-4 days' },
          { value: 'c', label: '1 month' },
          { value: 'd', label: 'Same day only' },
        ],
      },
      {
        id: 'q5',
        text: 'What should you do if the homeowner still says no after handling their objection?',
        options: [
          { value: 'a', label: 'Keep pushing until they agree' },
          { value: 'b', label: 'Leave on a good note, mention you\'ll be seeing neighbors, and give your card' },
          { value: 'c', label: 'Walk away without saying anything' },
          { value: 'd', label: 'Argue with their reasoning' },
        ],
      },
      {
        id: 'q6',
        text: 'When explaining hail damage to homeowners, what causes the long-term problem?',
        options: [
          { value: 'a', label: 'Immediate leaking' },
          { value: 'b', label: 'The sun chews through the exposed asphalt after granules loosen' },
          { value: 'c', label: 'Wind blowing shingles off' },
          { value: 'd', label: 'Snow buildup' },
        ],
      },
      {
        id: 'q7',
        text: 'What should you NEVER do on the phone or at the door?',
        options: [
          { value: 'a', label: 'Introduce yourself' },
          { value: 'b', label: 'Ask for two appointment times' },
          { value: 'c', label: 'SELL - the only purpose is to schedule an inspection' },
          { value: 'd', label: 'Give them your phone number' },
        ],
      },
      {
        id: 'q8',
        text: 'How long apart should you schedule inspections when starting out?',
        options: [
          { value: 'a', label: '30 minutes' },
          { value: 'b', label: '1.5-2 hours' },
          { value: 'c', label: '4-5 hours' },
          { value: 'd', label: 'All in the same hour' },
        ],
      },
      {
        id: 'q9',
        text: 'Why is it important to have both decision-makers (husband & wife) present?',
        options: [
          { value: 'a', label: 'It\'s company policy' },
          { value: 'b', label: 'So both can make the decision together and you don\'t have to return' },
          { value: 'c', label: 'It\'s required by law' },
          { value: 'd', label: 'To have more people to talk to' },
        ],
      },
      {
        id: 'q10',
        text: 'When "firming up" an appointment, what should you ask them to do?',
        options: [
          { value: 'a', label: 'Sign a contract' },
          { value: 'b', label: 'Write down the appointment date/time on their calendar and take your phone number' },
          { value: 'c', label: 'Pay a deposit' },
          { value: 'd', label: 'Call their insurance company' },
        ],
      },
    ],
  },
  {
    id: 'understanding-insurance',
    title: 'Understanding Insurance',
    description: 'Learn insurance terminology, how claims are paid, and how to explain the process to homeowners.',
    icon: '📋',
    duration: '45 minutes',
    headerImage: insuranceClaimExample,
    objectives: [
      'Master insurance terminology (ACV, RCV, Depreciation)',
      'Understand how payments are structured',
      'Explain the value proposition to homeowners',
      'Read insurance paperwork confidently',
    ],
    content: [
      {
        section: 'Key Insurance Terms',
        subtitle: 'The vocabulary of claims',
        image: insuranceClaimExample,
        imageCaption: 'Example of an insurance claim document',
        items: [
          { type: 'highlight', content: 'ACV (Actual Cash Value): The fair market value of an item today in its current condition' },
          { type: 'highlight', content: 'Depreciation: The reduction in value due to wear, tear, age, or obsolescence' },
          { type: 'highlight', content: 'RCV (Replacement Cost Value): The amount to replace the item today with like kind and quality' },
          { type: 'formula', content: 'ACV + Depreciation = RCV' },
        ],
        keyTakeaway: 'Memorize this formula: ACV + Depreciation = RCV',
      },
      {
        section: 'Understanding Depreciation',
        subtitle: 'A real-world example',
        items: [
          { type: 'example', content: 'A 30-year architectural shingle roof that is 10 years old has depreciated by 33% (10/30 = 33%)' },
          { type: 'example', content: 'If replacement cost is $10,000, depreciation is $3,300' },
          { type: 'example', content: 'ACV = $10,000 - $3,300 = $6,700' },
          { type: 'highlight', content: 'With a replacement cost policy, insurance still pays the full $10,000 RCV!' },
        ],
        keyTakeaway: 'Depreciation is held back, not lost.',
      },
      {
        section: 'Types of Policies',
        subtitle: 'Know what the homeowner has',
        items: [
          { type: 'highlight', content: 'Replacement Cost Policy: Pays whatever it costs to replace in today\'s market (most common)' },
          { type: 'warning', content: 'ACV Policy: Only pays actual cash value, NOT full replacement (rare, usually on rentals or old homes)' },
          { type: 'warning', content: 'ACV policies have NON-RECOVERABLE depreciation—homeowner pays the difference!' },
        ],
        keyTakeaway: 'Most homeowners have replacement cost policies.',
      },
      {
        section: 'How Payments Work',
        subtitle: 'The two-check system',
        items: [
          { type: 'highlight', content: 'Payments are divided into TWO checks:' },
          { type: 'text', content: '1️⃣ ACV Check: Issued first when claim is approved' },
          { type: 'text', content: '2️⃣ Depreciation Check: Held back until work is completed' },
          { type: 'formula', content: 'ACV check + Deductible + Depreciation check = RCV (grand total)' },
          { type: 'tip', content: 'Once depreciation is issued, the full RCV has been paid.' },
        ],
        keyTakeaway: 'Two checks = complete payment.',
      },
      {
        section: 'Understanding Deductibles',
        subtitle: 'The homeowner\'s responsibility',
        items: [
          { type: 'highlight', content: 'Deductible: The fixed out-of-pocket amount a homeowner pays before insurance covers the rest' },
          { type: 'tip', content: 'Think of it like a co-pay at the doctor\'s office!' },
          { type: 'text', content: 'The initial ACV payment is "less the deductible"' },
          { type: 'highlight', content: 'Deductible stays the same whether they get a cheap roof or a premium roof!' },
        ],
        keyTakeaway: 'Fixed deductible = no reason to go cheap.',
      },
      {
        section: 'Payment Example',
        subtitle: 'Walking through the math',
        items: [
          { type: 'example', content: 'Claim RCV: $10,000 | Deductible: $1,000 | ACV: $7,000' },
          { type: 'example', content: 'First check: $7,000 (ACV) - $1,000 (deductible) = $6,000' },
          { type: 'example', content: 'Depreciation held back: $3,000' },
          { type: 'formula', content: 'After completion: $6,000 + $1,000 + $3,000 = $10,000 RCV ✓' },
        ],
        keyTakeaway: 'The math always works out to full RCV.',
      },
      {
        section: 'Why "Bid Shopping" Doesn\'t Work',
        subtitle: 'Modern insurance explained',
        items: [
          { type: 'text', content: 'Insurance USED TO ask homeowners to collect 3 bids and choose the lowest' },
          { type: 'highlight', content: 'NOW: Adjuster writes the estimate using fair market pricing software' },
          { type: 'warning', content: 'If you invoice less than the RCV, insurance only releases enough to cover the invoice' },
          { type: 'tip', content: 'There\'s no incentive to go cheap—get the best quality for your deductible!' },
        ],
        keyTakeaway: 'Insurance pays what\'s invoiced—don\'t leave money on the table.',
      },
      {
        section: 'The Value Proposition',
        subtitle: 'Why quality matters',
        items: [
          { type: 'highlight', content: 'Homeowner\'s out-of-pocket cost is ALWAYS their fixed deductible, regardless of final price' },
          { type: 'script', content: '"If you could pick a brand new car for just $1,000, would you choose a Honda Civic or a BMW?"' },
          { type: 'tip', content: 'It makes sense to get maximum VALUE for what they\'re personally spending' },
        ],
        keyTakeaway: 'Same deductible = get the best roof possible.',
      },
      {
        section: 'Special Insurance Terms',
        subtitle: 'Reading the fine print',
        items: [
          { type: 'warning', content: 'Non-Recoverable Depreciation: Some items may have depreciation that cannot be recovered' },
          { type: 'tip', content: 'Look for carrots >> or asterisks * indicating non-recoverable items' },
          { type: 'highlight', content: 'PWI (Paid When Incurred): Insurance pays for the item only after it has been completed' },
          { type: 'text', content: 'Other Structures: Separate claims for detached garage or shed—add these totals together' },
        ],
        keyTakeaway: 'Watch for symbols that indicate exceptions.',
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What does ACV stand for?',
        options: [
          { value: 'a', label: 'Additional Coverage Value' },
          { value: 'b', label: 'Actual Cash Value' },
          { value: 'c', label: 'Approved Claim Value' },
          { value: 'd', label: 'Annual Coverage Verification' },
        ],
      },
      {
        id: 'q2',
        text: 'What is the correct formula for insurance payments?',
        options: [
          { value: 'a', label: 'ACV - Depreciation = RCV' },
          { value: 'b', label: 'RCV + Deductible = ACV' },
          { value: 'c', label: 'ACV + Depreciation = RCV' },
          { value: 'd', label: 'Deductible + RCV = ACV' },
        ],
      },
      {
        id: 'q3',
        text: 'When is the depreciation check released by the insurance company?',
        options: [
          { value: 'a', label: 'Immediately when the claim is approved' },
          { value: 'b', label: 'After the work is completed and invoiced' },
          { value: 'c', label: 'Before the ACV check' },
          { value: 'd', label: 'Only if the homeowner requests it' },
        ],
      },
      {
        id: 'q4',
        text: 'A homeowner has a $10,000 claim with a $1,000 deductible. Their ACV is $7,000. What is their first check amount?',
        options: [
          { value: 'a', label: '$7,000' },
          { value: 'b', label: '$6,000 (ACV minus deductible)' },
          { value: 'c', label: '$10,000' },
          { value: 'd', label: '$3,000' },
        ],
      },
      {
        id: 'q5',
        text: 'What does PWI (Paid When Incurred) mean on insurance paperwork?',
        options: [
          { value: 'a', label: 'The item is already paid for' },
          { value: 'b', label: 'The item is not covered' },
          { value: 'c', label: 'Insurance will pay for the item only after it has been completed' },
          { value: 'd', label: 'The homeowner must pay this amount' },
        ],
      },
      {
        id: 'q6',
        text: 'What type of policy pays the full replacement cost regardless of depreciation?',
        options: [
          { value: 'a', label: 'ACV Policy' },
          { value: 'b', label: 'Replacement Cost Policy' },
          { value: 'c', label: 'Limited Coverage Policy' },
          { value: 'd', label: 'Cash Only Policy' },
        ],
      },
      {
        id: 'q7',
        text: 'What is the homeowner\'s deductible?',
        options: [
          { value: 'a', label: 'The total claim amount' },
          { value: 'b', label: 'A fixed out-of-pocket amount the homeowner pays before insurance covers the rest' },
          { value: 'c', label: 'The depreciation amount' },
          { value: 'd', label: 'An optional fee' },
        ],
      },
      {
        id: 'q8',
        text: 'Why doesn\'t "bid shopping" work with modern insurance claims?',
        options: [
          { value: 'a', label: 'Insurance companies don\'t accept bids' },
          { value: 'b', label: 'The adjuster writes the estimate using fair market pricing software, and only releases what is invoiced' },
          { value: 'c', label: 'Homeowners are required to use specific contractors' },
          { value: 'd', label: 'It takes too long' },
        ],
      },
      {
        id: 'q9',
        text: 'What symbols indicate non-recoverable depreciation on insurance paperwork?',
        options: [
          { value: 'a', label: 'Dollar signs $' },
          { value: 'b', label: 'Carrots >> or asterisks *' },
          { value: 'c', label: 'Parentheses ()' },
          { value: 'd', label: 'Underlines' },
        ],
      },
      {
        id: 'q10',
        text: 'In the car analogy, why should a homeowner get the best quality roof for their deductible?',
        options: [
          { value: 'a', label: 'Because cheaper roofs are illegal' },
          { value: 'b', label: 'Their out-of-pocket cost is the same fixed deductible regardless of roof quality' },
          { value: 'c', label: 'Insurance companies require premium materials' },
          { value: 'd', label: 'It doesn\'t matter what quality they choose' },
        ],
      },
    ],
  },
  {
    id: 'job-cycle-adjuster',
    title: 'Job Cycle & Adjuster Meetings',
    description: 'Understand the complete storm restoration process and how to conduct professional adjuster meetings.',
    icon: '🔄',
    duration: '40 minutes',
    headerImage: jobCycleOverview,
    objectives: [
      'Understand the Sign → Build → Collect workflow',
      'Conduct professional adjuster meetings',
      'Handle claim denials gracefully',
      'Close homeowners with confidence',
    ],
    content: [
      {
        section: 'The 3 Main Stages',
        subtitle: 'Sign → Build → Collect',
        image: jobCycleOverview,
        imageCaption: 'The job cycle overview',
        items: [
          { type: 'highlight', content: '1️⃣ SIGN - Get the homeowner agreement' },
          { type: 'highlight', content: '2️⃣ BUILD - Complete the construction work' },
          { type: 'highlight', content: '3️⃣ COLLECT - Collect all payments including depreciation' },
          { type: 'tip', content: 'Every deal follows this same cycle—master it!' },
        ],
        keyTakeaway: 'SIGN → BUILD → COLLECT',
      },
      {
        section: 'Step-By-Step Job Cycle',
        subtitle: 'The complete process',
        image: jobCycleSteps,
        imageCaption: 'Detailed job cycle steps',
        items: [
          { type: 'text', content: '1. Hail and/or wind storm hits an area, damaging thousands of homes' },
          { type: 'text', content: '2. Storm restoration contractors set up free inspections' },
          { type: 'text', content: '3. Inspection completed, damage photographed and documented' },
          { type: 'text', content: '4. Homeowner and contractor make agreement contingent upon insurance approval' },
          { type: 'text', content: '5. Homeowner files a claim' },
          { type: 'text', content: '6. Contractor measures, diagrams, & estimates damages' },
          { type: 'text', content: '7. Insurance adjuster sets appointment' },
          { type: 'text', content: '8. Contractor meets with adjuster to review scope' },
          { type: 'text', content: '9. Adjuster approves claim' },
        ],
        keyTakeaway: 'Know every step in the process.',
      },
      {
        section: 'Job Cycle: Build & Collect',
        subtitle: 'After approval',
        items: [
          { type: 'text', content: '10. Homeowner receives insurance paperwork & 1st check (ACV check)' },
          { type: 'text', content: '11. Scope of work is confirmed (roof, siding, gutters, etc.)' },
          { type: 'text', content: '12. 1st check collected as material deposit' },
          { type: 'text', content: '13. Materials ordered and delivered' },
          { type: 'text', content: '14. Construction completed' },
          { type: 'text', content: '15. Invoice is sent to insurance for depreciation release' },
          { type: 'text', content: '16. Depreciation check is collected' },
          { type: 'text', content: '17. Job is capped out & commissions paid 🎉' },
        ],
        keyTakeaway: 'Follow through until the job is capped out.',
      },
      {
        section: 'After the Homeowner Signs',
        subtitle: 'Setting them up for success',
        items: [
          { type: 'highlight', content: 'Write these directions on their copy of the agreement:' },
          { type: 'checklist', content: '1) Call 1-800# on your policy and file your claim. Write down your claim #' },
          { type: 'checklist', content: '2) Get the adjuster\'s name and cell phone #' },
          { type: 'checklist', content: '3) Get the adjuster meeting date & time ★ IMPORTANT!' },
          { type: 'checklist', content: '4) Call me!' },
        ],
        keyTakeaway: 'Clear instructions = smooth process.',
      },
      {
        section: 'Adjuster Meeting Conduct',
        subtitle: 'Be a professional, not a fighter',
        items: [
          { type: 'highlight', content: 'Be cool, friendly, and nice! This is NOT a "court hearing" or a battle' },
          { type: 'tip', content: 'Let them do their job—you need common ground' },
          { type: 'checklist', content: 'Make their job easier by having all due diligence complete' },
          { type: 'warning', content: 'Don\'t exaggerate damage. Call it like it is.' },
          { type: 'checklist', content: 'Call a spade a spade—if something isn\'t damaged, don\'t fight about it' },
        ],
        keyTakeaway: 'Help the adjuster, don\'t fight the adjuster.',
      },
      {
        section: 'Adjuster Meeting Introduction',
        subtitle: 'Starting on the right foot',
        items: [
          { type: 'text', content: 'Introduce yourself on their arrival—smile, tell them your name, firmly shake their hand' },
          { type: 'script', content: '"So where are you from? They keeping you pretty busy with this storm?"' },
          { type: 'script', content: '"Can you show me what it is you\'re looking for? I\'m kind of new at this! I want to make sure I\'m looking at the right stuff."' },
          { type: 'tip', content: 'Build rapport for 5 minutes before talking business.' },
        ],
        keyTakeaway: 'Build rapport first, business second.',
      },
      {
        section: 'Working with the Adjuster',
        subtitle: 'Offering value without overstepping',
        items: [
          { type: 'text', content: 'Give the adjuster time and space to do their work' },
          { type: 'script', content: '"Hey (name), I know you\'ll be doing your own thing and putting together your own assessment..."' },
          { type: 'script', content: '"But I did make a copy of my EagleView, notes, measurements, and an Xactimate here for you if it makes your life easier."' },
          { type: 'script', content: '"Would it be cool if we took a minute at the end to go over it and compare apples to apples?"' },
        ],
        keyTakeaway: 'Offer to help, but let them lead.',
      },
      {
        section: 'Getting Marginal Damages Approved',
        subtitle: 'The power of questions',
        items: [
          { type: 'script', content: '"Hey (name), I wanted to get your opinion on this here... I couldn\'t say for certain it WAS hail damage, but I also couldn\'t say for certain that it wasn\'t. What do you think?"' },
          { type: 'script', content: '"Hey, I don\'t really know what this is necessarily. I thought I\'d show it to you and see what you thought."' },
          { type: 'tip', content: 'Ask questions rather than making demands—let them be the expert.' },
        ],
        keyTakeaway: 'Questions > demands.',
      },
      {
        section: 'Handling Claim Denials',
        subtitle: 'When the adjuster says no',
        items: [
          { type: 'warning', content: 'If the adjuster denies the roof or doesn\'t agree with your scope:' },
          { type: 'checklist', content: 'Calmly ask questions to understand their reasoning—don\'t argue' },
          { type: 'checklist', content: 'When they leave, explain to homeowner that you don\'t agree with the assessment' },
          { type: 'checklist', content: 'Instruct them to call insurance to request a re-inspection with a different adjuster' },
          { type: 'tip', content: 'A second opinion often results in approval!' },
        ],
        keyTakeaway: 'Denial ≠ game over. Request re-inspection.',
      },
      {
        section: 'Adjuster Meeting Packet',
        subtitle: 'Be prepared',
        items: [
          { type: 'checklist', content: 'Xactimate estimate' },
          { type: 'checklist', content: 'Diagram/EagleView + notes' },
          { type: 'checklist', content: 'Copy of agreement with homeowner' },
          { type: 'checklist', content: 'Business cards (leave on top)' },
          { type: 'highlight', content: 'Arrive at least 30 minutes ahead to settle and set up' },
          { type: 'tip', content: 'Circle 5-7 hits on the roof (not the most obvious ones—leave some for the adjuster to find)' },
        ],
        keyTakeaway: 'Preparation shows professionalism.',
      },
      {
        section: 'Keys to Closing Homeowners',
        subtitle: 'Sealing the deal',
        items: [
          { type: 'checklist', content: 'Make sure both decision-makers are present' },
          { type: 'tip', content: 'Sit at the kitchen table—most natural place to cover material' },
          { type: 'highlight', content: 'FOLLOW THE PRESENTATION SCRIPT word-for-word. It works!' },
          { type: 'text', content: 'Be calm, confident, direct, and clear—speak slowly' },
          { type: 'text', content: 'Mirror your customer—if they\'re relaxed, be casual' },
          { type: 'warning', content: 'Don\'t pull out agreement paperwork until the moment to go over details' },
          { type: 'highlight', content: 'Hand over the pen and BE QUIET after you ask them to sign—lean back and remain neutral' },
        ],
        keyTakeaway: 'Hand over the pen. Then BE QUIET.',
      },
    ],
    exam: [
      {
        id: 'q1',
        text: 'What are the 3 main stages of the job cycle?',
        options: [
          { value: 'a', label: 'Measure, Build, Invoice' },
          { value: 'b', label: 'Sign, Build, Collect' },
          { value: 'c', label: 'Inspect, Approve, Install' },
          { value: 'd', label: 'Quote, Negotiate, Close' },
        ],
      },
      {
        id: 'q2',
        text: 'How should you conduct yourself during an adjuster meeting?',
        options: [
          { value: 'a', label: 'Be aggressive and argue for every item' },
          { value: 'b', label: 'Be cool, friendly, and help make their job easier' },
          { value: 'c', label: 'Let the homeowner do all the talking' },
          { value: 'd', label: 'Avoid the adjuster and just submit paperwork' },
        ],
      },
      {
        id: 'q3',
        text: 'When should you arrive for an adjuster meeting?',
        options: [
          { value: 'a', label: 'Right on time' },
          { value: 'b', label: '5 minutes early' },
          { value: 'c', label: 'At least 30 minutes ahead to settle and set up' },
          { value: 'd', label: '10 minutes late to let them start first' },
        ],
      },
      {
        id: 'q4',
        text: 'What should you do if the adjuster denies the claim?',
        options: [
          { value: 'a', label: 'Argue with the adjuster until they change their mind' },
          { value: 'b', label: 'Calmly ask questions, then instruct homeowner to request a re-inspection with a different adjuster' },
          { value: 'c', label: 'Give up and leave' },
          { value: 'd', label: 'Tell the homeowner the claim is hopeless' },
        ],
      },
      {
        id: 'q5',
        text: 'After asking the homeowner to sign, what should you do?',
        options: [
          { value: 'a', label: 'Keep talking about the benefits' },
          { value: 'b', label: 'Hand over the pen and BE QUIET - lean back and remain neutral' },
          { value: 'c', label: 'Show them more pictures of damage' },
          { value: 'd', label: 'Offer a discount' },
        ],
      },
      {
        id: 'q6',
        text: 'What should be in your adjuster meeting packet?',
        options: [
          { value: 'a', label: 'Just your business cards' },
          { value: 'b', label: 'Xactimate, Diagram/EagleView, agreement copy, business cards' },
          { value: 'c', label: 'Only the homeowner\'s paperwork' },
          { value: 'd', label: 'Nothing - let the adjuster provide everything' },
        ],
      },
      {
        id: 'q7',
        text: 'When circling hail damage before the adjuster arrives, how many hits should you mark?',
        options: [
          { value: 'a', label: 'Every single hit you can find' },
          { value: 'b', label: '5-7 hits (not the most obvious ones)' },
          { value: 'c', label: 'None - let the adjuster find them all' },
          { value: 'd', label: 'Only 1-2 hits' },
        ],
      },
      {
        id: 'q8',
        text: 'After signing, what 4 things should homeowners do?',
        options: [
          { value: 'a', label: 'Wait for you to call them' },
          { value: 'b', label: 'Call insurance, write claim #, get adjuster info, call you' },
          { value: 'c', label: 'Pay the deposit immediately' },
          { value: 'd', label: 'Schedule the installation date' },
        ],
      },
      {
        id: 'q9',
        text: 'Where is the best place to close homeowners?',
        options: [
          { value: 'a', label: 'On the roof' },
          { value: 'b', label: 'At the kitchen table' },
          { value: 'c', label: 'In the driveway' },
          { value: 'd', label: 'At your office' },
        ],
      },
      {
        id: 'q10',
        text: 'How should you handle marginal damage with the adjuster?',
        options: [
          { value: 'a', label: 'Insist it\'s definitely hail damage' },
          { value: 'b', label: 'Ask questions about it - "I couldn\'t say for certain... what do you think?"' },
          { value: 'c', label: 'Ignore it completely' },
          { value: 'd', label: 'Argue until they agree' },
        ],
      },
    ],
  },
];
