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
    id: 'titan-prime-standard',
    title: 'Titan Prime Standard',
    description: 'Required training on company values, professional conduct, and CRM responsibilities before gaining full access.',
    icon: '⚔️',
    duration: '20 minutes',
    content: [
      {
        section: 'Welcome to Titan Prime Solutions',
        items: [
          'Titan Prime Solutions is a premium roofing and home improvement company built on professionalism, trust, and performance.',
          'This is not a casual sales role — you represent a high-standard brand.',
          'Every interaction you have with homeowners, teammates, and partners reflects on Titan Prime Solutions.',
          'Our expectation is simple: Act like a professional. Perform like a winner. Protect the brand.',
        ],
      },
      {
        section: 'The Titan Prime Standard',
        items: [
          'As a Titan Prime representative, you are expected to operate at a higher level than the average salesperson.',
          'Be punctual and reliable',
          'Dress and present yourself professionally',
          'Communicate clearly and respectfully',
          'Follow through on commitments',
          'Take responsibility for your results',
          'Represent Titan Prime with integrity',
          'If you wear the Titan Prime name, you carry the Titan Prime reputation.',
        ],
      },
      {
        section: 'Customer Experience & Homeowner Conduct',
        items: [
          'Homeowners trust us with one of their biggest assets — their home.',
          'Speak respectfully and professionally',
          'Never pressure or mislead a homeowner',
          'Clearly explain pricing, timelines, and expectations',
          'Keep properties clean and respected',
          'Avoid confrontational or aggressive behavior',
          'Never argue with customers — escalate issues professionally',
          'Always leave a positive impression, even if a deal doesn\'t close',
          'We sell trust, not just roofs.',
        ],
      },
      {
        section: 'Honesty, Ethics & Compliance',
        items: [
          'Titan Prime Solutions operates with zero tolerance for unethical behavior.',
          'You may NOT: Lie to homeowners or partners',
          'You may NOT: Manipulate contracts or pricing',
          'You may NOT: Promise services or timelines you can\'t guarantee',
          'You may NOT: Use deceptive sales tactics',
          'You may NOT: Misrepresent insurance processes',
          'You may NOT: Engage in fraud or dishonest reporting',
          'If something feels questionable — don\'t do it. Protect the customer. Protect the company.',
        ],
      },
      {
        section: 'Professional Conduct & Behavior',
        items: [
          'To protect our culture and brand, the following behaviors are not acceptable:',
          'Harassment or discrimination of any kind',
          'Substance use while working or at job sites',
          'Verbal or physical conflicts with teammates or customers',
          'Posting inappropriate content tied to Titan Prime on social media',
          'Gossip, drama, or disruptive behavior',
          'Damaging company relationships or reputation',
          'Titan Prime is a professional organization — act like it.',
        ],
      },
      {
        section: 'Accountability & Ownership Culture',
        items: [
          'At Titan Prime, we believe in ownership over excuses.',
          'You are responsible for: Your performance',
          'You are responsible for: Your communication with customers',
          'You are responsible for: Your follow-ups',
          'You are responsible for: Your paperwork and CRM accuracy',
          'You are responsible for: Solving problems instead of blaming others',
          'Leaders take ownership. Excuses don\'t build careers here.',
        ],
      },
      {
        section: 'Winning Mindset & Performance Expectations',
        items: [
          'Titan Prime is building a high-performing sales team.',
          'We value reps who are: Driven',
          'We value reps who are: Coachable',
          'We value reps who are: Competitive',
          'We value reps who are: Reliable',
          'We value reps who are: Focused on growth',
          'We value reps who are: Willing to learn and improve',
          'Average effort will not produce elite income.',
          'If you want to win, grow, and earn at a high level — you belong here.',
        ],
      },
      {
        section: 'CRM & Operations Responsibility',
        items: [
          'Before receiving full CRM access, reps must:',
          'Submit a completed W-9',
          'Use a company-approved work email',
          'Complete onboarding training',
          'Pass required quizzes and acknowledgments',
          'CRM rules: Log all deals honestly and accurately',
          'CRM rules: Do not falsify customer information',
          'CRM rules: Keep customer data confidential',
          'CRM rules: Follow company workflow processes',
          'The CRM is a business tool — misuse may result in termination.',
        ],
      },
      {
        section: 'Team Culture & Brand Identity',
        items: [
          'Titan Prime Solutions is not just a workplace — it\'s a team culture.',
          'We are building a group of: Winners, Leaders, Professionals, High-earners, Long-term builders',
          'We support teammates, respect leadership, and represent the Titan Prime brand with pride.',
          'You\'re not just selling — you\'re helping build a respected company.',
        ],
      },
      {
        section: 'Commitment to the Titan Prime Standard',
        items: [
          'By working with Titan Prime Solutions, you agree to:',
          'Uphold company values',
          'Protect the brand\'s reputation',
          'Operate with integrity and professionalism',
          'Strive for growth and performance',
          'Follow training, policies, and leadership direction',
          'This is an opportunity to build a serious career — treat it seriously.',
        ],
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
    content: [
      {
        section: 'Terms & Definitions',
        items: [
          'Square: A unit of measure in roofing and siding. 1 square = 100 square feet (10\'x10\')',
          'Actual: The actual number of squares on the roof (not including waste, starter, or ridge cap)',
          'Rakes: Edges that slope at a diagonal on the roof (i.e., gable ends)',
          'Eaves: Run parallel to the ground on the roof (i.e., where gutters hang)',
          'Pitch: Steepness of the roof, expressed as X over 12 (rise over run). A 4/12 slope is mild, 10/12 is steep',
          'Valley: Where slopes of opposing directions meet to create a V',
          'Ridge: Where slopes of opposing directions meet to create a peak or high point (ridge cap covers these joints)',
          'Flashing: Protecting penetrations in the roof with metal to prevent water from entering',
        ],
      },
      {
        section: 'Types of Flashing',
        items: [
          'Counterflashing / Z-flashing / Roof-to-wall flashing: Installed where roof meets a wall, runs from left to right, not on a slope',
          'Step flashing: Installed where roof meets a wall on a diagonal (e.g., on the side of a dormer)',
        ],
      },
      {
        section: 'Types/Styles of Roofs',
        items: [
          'Hip roof (envelope shape) - Has slopes on all four sides',
          'Gable roof (A-frame) - Has two sloping sides that meet at a ridge',
          'Gambrel/Mansard (barn style) - Has two different slopes on each side',
          'Flat (typically "modified bitumen" material) - Low slope or no slope',
        ],
      },
      {
        section: 'Waste Calculation',
        items: [
          'Waste: Percentage allowance for material "waste" during construction',
          'Use 10% waste for gable roofs',
          'Use 15% waste for hip roofs',
          'Calculate by: actual squares multiplied times waste % (Example: 30 gable × 10% = 3 waste, so 33 total)',
        ],
      },
      {
        section: 'Exterior Roof Components',
        items: [
          'Ridge / ridge vent - At the peak of the roof for ventilation',
          'Shingles ("field" shingles) - Main roofing material covering the deck',
          'Underlayment / felt - Protective layer under shingles',
          'Decking - Plywood or OSB surface that shingles are nailed to',
          'Ice & water shield / Weather guard - Extra protection in valleys and eaves',
          'Fascia - Board along the eave edge',
          'Drip edge - Metal edging at eaves and rakes',
        ],
      },
      {
        section: 'Shingle Types',
        items: [
          '3-Tab Shingle: Flat, looks like bricks - older style',
          'Architectural Shingle: 3-dimensional, more modern appearance',
          'Both are asphalt shingles - the most common roofing material',
        ],
      },
      {
        section: 'Roof Penetrations & Vents',
        items: [
          'Pipe jack (neoprene boot, 3-in-1) - Covers plumbing vents',
          'Lead pipe boot - Metal pipe covering',
          'Chimney flashing - Waterproofing around chimney base',
          'Chimney cricket - Diverts water around chimney',
          'Turtle vent / box vent - Static ventilation',
          'Ridge vent (Shingle over Style) - Ventilation along ridge',
          'Aluminum ridge vent - Metal ridge ventilation',
          'Turbine vent / whirlybird - Spinning ventilation',
          'Power attic fan - Electric ventilation',
        ],
      },
      {
        section: 'Important Notes on Decking',
        items: [
          'Decking/sheathing is only replaced locally where wood rot is found',
          'Insurance does NOT cover wood rot',
          'Rotten areas will feel very soft and spongy',
          'Areas where leaks have historically been present may have rotted decking',
          'Attic insulation is not affected and does not need to be replaced',
        ],
      },
      {
        section: 'Siding Components',
        items: [
          'J-channel - Trim around doors/windows',
          'Fascia - Along eaves/rakes (6-8" usually)',
          'Window wrap - Trim around windows',
          'Soffit - Underneath eaves',
          'Inside corner post - Interior corners',
          'Outside corner post - Exterior corners',
          'Gable vent - Ventilation in gable ends',
          'House wrap/moisture barrier - Behind siding',
          'Starter strip - Bottom edge of siding',
        ],
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
    content: [
      {
        section: 'General Diagramming Rules',
        items: [
          'Write homeowner\'s last name and address in upper right corner of every diagram',
          'Include orientation of the diagram (front, rear, right, left)',
          'Document: Eaves, Rakes, Valleys, Ridges/Hips',
          'On hips, don\'t forget to measure the height of trapezoids (distance between base1 & base2)',
        ],
      },
      {
        section: 'Basic Mathematical Formulas',
        items: [
          'Square/Rectangle: Length × Width',
          'Trapezoid (for hips): (Base1 + Base2) × Height ÷ 2',
          'Triangle: Base × Height ÷ 2 (or 0.5 × Base × Height)',
          'Pythagorean Theorem: a² + b² = c² (c = longest side)',
          'Convert square feet to squares: Divide by 100',
        ],
      },
      {
        section: 'Measurement Examples',
        items: [
          'Rectangle example: 30 × 18 = 540 sq ft = 5.4 squares',
          'Trapezoid example: (40 + 20) × 10 ÷ 2 = 300 sq ft = 3 squares',
          'Triangle example: 14 × 16 ÷ 2 = 112 sq ft = 1.12 squares',
        ],
      },
      {
        section: 'When to Measure Yourself vs. Order Reports',
        items: [
          'If it takes less than 20 minutes to diagram and measure - do it yourself',
          'For really difficult, multi-steep, or 3+ story roofs - order an EagleView or RoofScope report',
          'Ordering a report saves time and can be safer than climbing complicated roofs',
        ],
      },
      {
        section: 'Measuring Siding',
        items: [
          'Calculate measurements in squares or square feet PER elevation',
          'Simplify by dividing elevations into simple shapes (rectangles and triangles)',
          'Measure the width of the elevation',
          'Measure the height of siding panel in inches',
          'Count the number of panels high per "shape"',
          'Formula: # of panels × panel height in inches ÷ 12 = height in feet',
        ],
      },
      {
        section: 'Siding Diagram Requirements',
        items: [
          'Orientation of sides (front, rear, left, right)',
          'Clearly mark which sides are damaged',
          'Note the size of panels and type of material',
        ],
      },
      {
        section: 'Estimating Checklist',
        items: [
          'Actual squares (total roof area)',
          'Squares + waste (add 10% for gable, 15% for hip)',
          'Eaves linear feet (LF)',
          'Rakes linear feet (LF)',
          'Ridge/hip linear feet (LF)',
          'Valley linear feet (LF)',
          'Style of roof (gable, hip, combination)',
        ],
      },
      {
        section: 'Pro Tips for Measuring',
        items: [
          'Divide complex areas into simpler shapes to calculate area',
          'For hip portions within a gable roof, calculate waste separately',
          'Always double-check your math before presenting to the homeowner',
          'Take photos of your measurements for reference',
        ],
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
    content: [
      {
        section: 'Phone Approach Script',
        items: [
          '"Hey _____, this is (name). How\'s it going? Great! Well do you have a quick second or did I catch you at a bad time?"',
          '"The reason I\'m calling is I just started a new job here working for (company). I\'m helping out with taking care of homeowners in the area who were hit with that big hail storm."',
          '"For my first couple weeks, one of my assignments is to practice doing some inspections. My goal is to look at 10 roofs by Saturday."',
          '"Would you be nice enough to let me stop by and do a practice run with you? Would (day) at (time) or (time) work better for you?"',
        ],
      },
      {
        section: 'Phone Firm Up Script',
        items: [
          '"Can you do me a big favor? Let me know when to have a pen."',
          '"Can you write down that I\'ll be by on (day) at (time) on your calendar?"',
          '"Here\'s my phone number in case something pops up: ###-###-####"',
          '"What\'s your address again? Is your house 1 or 2 stories?"',
          '"If it rains, I obviously can\'t get on the roof, so I\'ll call you if anything pops up."',
        ],
      },
      {
        section: 'Door Knocking Approach',
        items: [
          '"Hey, how\'s it going? I\'m really sorry to bother you."',
          '"Do you by chance know (neighbor\'s name) who lives right over there? They\'re actually my (friend/uncle/coach)."',
          '"I just got done taking a look at their roof. They had me do an inspection because of that big hail storm."',
          '"I actually did find some hail damage up there, which isn\'t too surprising considering most cars in the area got dinged up."',
          '"I\'m going to be back out here on (day) and (day) to do a few more free inspections. Would (day) at (time) or (time) work better for you?"',
        ],
      },
      {
        section: 'Further Explaining the Inspection',
        items: [
          '"Basically what we\'ll do is hop up on the roof, take a look around and see if there\'s any bruising from the hail."',
          '"Hail leaves \'bruises\' which are soft spots on the shingles. It causes granules to loosen and erode, exposing asphalt to the sun."',
          '"It can take months or years, but eventually the sun chews a hole through and then you get leaks."',
          '"Insurance covers it if it\'s damaged. If there\'s no damage, we\'ll just let you know you\'re looking good."',
        ],
      },
      {
        section: 'Handling Objections: Feel-Felt-Found Method',
        items: [
          'Acknowledge their concern (AGREE)',
          'Say "I totally understand how you feel..."',
          'Share that others "felt the same way..."',
          'Explain what they "found" was beneficial',
          'Ask for two appointment times again',
        ],
      },
      {
        section: 'Common Objection: "I don\'t have any damage"',
        items: [
          '"I totally understand, in fact a lot of people have felt the same way..."',
          '"Unlike wind damage which rips shingles off, hail damage is really hard to spot and doesn\'t leak for months or years."',
          '"What they found was it was better safe than sorry to get it checked out, just in case."',
          '"It\'s a free inspection. We\'re not going to tell you you need a new roof if you don\'t. Would (day) at (time) or (time) work better?"',
        ],
      },
      {
        section: 'Common Objection: "My husband/neighbor already looked at it"',
        items: [
          '"I totally understand, in fact one of your neighbors said the same thing."',
          '"But she had me take a look anyway because her husband is a dentist and admitted he didn\'t really know what he was looking for."',
          '"They were glad they had me take a look because they actually did have hail damage."',
          '"I ended up meeting with their insurance company who agreed to pay to replace their roof. Would Monday at (time) or (time) work better?"',
        ],
      },
      {
        section: 'Tips for Scheduling Inspections',
        items: [
          'Keep it simple and relaxed. Don\'t be salesy or over-the-top enthusiastic',
          'Have appointment slots already blocked off in your planner beforehand',
          'Start by scheduling inspections 1.5-2 hours apart',
          'ALWAYS offer TWO times (gives them choices instead of a yes or no question)',
          'Make sure both husband & wife can be there',
          'Always confirm appointments by firming up',
          'Never schedule more than 3-4 days in advance (too easy for people to forget)',
          'Don\'t do an inspection on the spot - setting an appointment gives you 2 impressions instead of 1',
          'Do NOT SELL on the phone/at the door - the ONLY reason you\'re calling is to schedule an inspection',
        ],
      },
      {
        section: 'If They Still Say No',
        items: [
          'Never take it personally! Leave it on a good note',
          'Many people who initially didn\'t schedule later see neighbors getting new roofs and call back',
          '"No problem! I\'m going to be seeing several of your neighbors this week, so if you change your mind, just wave me over."',
          '"Here\'s my card if you want to give me a call! Have a good night."',
        ],
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
    content: [
      {
        section: 'Key Insurance Terms',
        items: [
          'ACV (Actual Cash Value): The fair market value of an item today in its current condition',
          'Depreciation: The reduction in value of an item due to wear and tear, age, or obsolescence',
          'RCV (Replacement Cost Value): The amount to replace the item today with like kind and quality, regardless of age',
          'Formula: ACV + Depreciation = RCV',
        ],
      },
      {
        section: 'Understanding Depreciation - Example',
        items: [
          'Example: A 30-year architectural shingle roof that is 10 years old',
          'It has depreciated by 33% (10/30 = 33%)',
          'If replacement cost is $10,000, depreciation is $3,300',
          'ACV = $10,000 - $3,300 = $6,700',
          'Insurance will still pay the full $10,000 RCV (with a replacement cost policy)',
        ],
      },
      {
        section: 'Types of Policies',
        items: [
          'Replacement Cost Policy: Pays whatever it costs to replace in today\'s market (most common)',
          'ACV Policy: Only pays actual cash value, NOT full replacement (rare, usually on rentals or old homes)',
          'ACV policies have NON-RECOVERABLE depreciation',
        ],
      },
      {
        section: 'How Insurance Payments Work',
        items: [
          'Payments are divided into TWO checks: ACV check and Depreciation check',
          'The ACV check is issued first',
          'The depreciation is held back until work is completed',
          'Once depreciation is issued, the full RCV has been paid',
        ],
      },
      {
        section: 'Understanding Deductibles',
        items: [
          'Deductible: The fixed out-of-pocket amount a homeowner pays before insurance covers the rest',
          'Think of it like a co-pay at the doctor\'s office',
          'The initial ACV payment is "less the deductible"',
          'Formula: ACV check + Deductible + Depreciation check = RCV (grand total)',
        ],
      },
      {
        section: 'Payment Example',
        items: [
          'Claim RCV: $10,000 | Deductible: $1,000',
          'ACV is $7,000, minus $1,000 deductible = First check of $6,000',
          'Depreciation held back: $3,000',
          'After work completed: $6,000 (ACV check) + $1,000 (deductible) + $3,000 (depreciation) = $10,000 RCV',
        ],
      },
      {
        section: 'Why "Bid Shopping" Doesn\'t Work Anymore',
        items: [
          'Insurance USED TO ask homeowners to collect 3 bids and choose the lowest',
          'NOW: Adjuster writes the estimate using fair market pricing software',
          'Insurance issues 2 checks: ACV first, then depreciation after completion',
          'The 2nd depreciation check is ONLY paid after the full claim amount has been invoiced',
          'If you invoice less than the RCV, insurance only releases enough to cover the invoice',
        ],
      },
      {
        section: 'The Value Proposition',
        items: [
          'Homeowner\'s out-of-pocket cost is ALWAYS their fixed deductible, regardless of final price',
          'So they should get the BEST quality for their money, not the cheapest option',
          'Analogy: "If you could pick a brand new car for just $1,000, would you choose a Honda Civic or a BMW?"',
          'It makes sense to get maximum VALUE for what they\'re personally spending',
        ],
      },
      {
        section: 'Special Insurance Terms',
        items: [
          'Non-Recoverable Depreciation: Some items (awnings, patio covers) may have depreciation that cannot be recovered',
          'Look for carrots >> or asterisks * on paperwork indicating non-recoverable items',
          'PWI (Paid When Incurred): Insurance will pay for the item only after it has been completed',
          'Other Structures: Separate claims for detached garage or shed - add these totals together',
        ],
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
    content: [
      {
        section: 'The 3 Main Stages',
        items: [
          '1. SIGN - Get the homeowner agreement',
          '2. BUILD - Complete the construction work',
          '3. COLLECT - Collect all payments including depreciation',
        ],
      },
      {
        section: 'Step-By-Step Job Cycle',
        items: [
          '1. Hail and/or wind storm hits an area, damaging thousands of homes',
          '2. Storm restoration contractors set up free inspections with homeowners in affected areas',
          '3. Inspection is completed, damage photographed, documented, and presented to homeowner',
          '4. Homeowner and contractor make an agreement contingent upon insurance approval & price',
          '5. Homeowner files a claim',
          '6. Contractor measures, diagrams, & estimates damages',
          '7. Insurance adjuster sets appointment to assess property',
          '8. Contractor meets with adjuster to review scope of damages',
          '9. Adjuster approves claim',
        ],
      },
      {
        section: 'Job Cycle Continued',
        items: [
          '10. Homeowner receives insurance paperwork/estimate & 1st check (ACV check)',
          '11. Scope of work is confirmed (roof, siding, gutters, etc.)',
          '12. 1st check collected as material deposit',
          '13. Materials ordered and delivered',
          '14. Construction completed',
          '15. Invoice is sent to insurance company for release of depreciation',
          '16. Depreciation check is collected',
          '17. Job is capped out & commissions paid',
        ],
      },
      {
        section: 'After the Homeowner Signs',
        items: [
          'Write the following directions on their copy of the agreement:',
          '1) Call 1-800# on your policy and file your claim. Write down your claim #',
          '2) Get the adjuster\'s name and cell phone #',
          '3) Get the adjuster meeting date & time ***IMPORTANT!',
          '4) Call me!',
        ],
      },
      {
        section: 'Adjuster Meeting Conduct',
        items: [
          'Be cool, friendly, and nice! This is NOT a "court hearing" or a battle',
          'Let them do their job - you have to have common ground',
          'Make their job easier by having all due diligence complete (or ready)',
          'Call a spade a spade - if there isn\'t really damage on something, don\'t fight about it',
          'Don\'t exaggerate damage. Call it like it is',
          'Make sure you\'re circling/highlighting legitimate hail/wind damage',
        ],
      },
      {
        section: 'Adjuster Meeting Introduction',
        items: [
          'Introduce yourself on their arrival - smile, tell them your name, firmly shake their hand',
          'Build rapport for 5 minutes: "So where are you from? They keeping you pretty busy with this storm?"',
          'Transition into directing attention toward the claim',
          'Ask: "Can you show me what it is you\'re looking for? I\'m kind of new at this! I want to make sure I\'m looking at the right stuff."',
        ],
      },
      {
        section: 'Working with the Adjuster',
        items: [
          'Give the adjuster time and space to do their work',
          'Then offer: "Hey (name), I know you\'ll be doing your own thing and putting together your own assessment..."',
          '"But I did make a copy of my EagleView, notes, measurements, and an Xactimate here for you if it makes your life easier."',
          '"Would it be cool if we took a minute at the end to go over it and compare apples to apples?"',
        ],
      },
      {
        section: 'Getting Marginal Damages Approved',
        items: [
          '"Hey (name), I wanted to get your opinion on this here... I couldn\'t say for certain it WAS hail damage, but I also couldn\'t say for certain that it wasn\'t. What do you think?"',
          '"Hey, I don\'t really know what this is necessarily. I thought I\'d show it to you and see what you thought."',
          'Ask questions rather than making demands',
        ],
      },
      {
        section: 'In the Event of Denial',
        items: [
          'If the adjuster is denying the roof or doesn\'t agree with your scope:',
          'Calmly ask questions to understand his reasoning - don\'t argue',
          'When he leaves, explain to homeowner that you don\'t completely agree with his assessment',
          'Instruct them to call their insurance company to request a re-inspection with a different adjuster for a second opinion',
        ],
      },
      {
        section: 'Adjuster Meeting Packet Checklist',
        items: [
          'Xactimate estimate',
          'Diagram/EagleView + notes',
          'Copy of agreement with homeowner',
          'Business cards (leave on top)',
          'Arrive at least 30 minutes ahead to settle',
          'Set up ladder',
          'Circle 5-7 hits on the roof (ideally not the most obvious ones - leave some good ones for the adjuster)',
          'Highlight soft metal damages on gutters, downspouts, siding, fascia, etc.',
        ],
      },
      {
        section: 'Keys to Closing Homeowners',
        items: [
          'Make sure both decision-makers are present (e.g., husband and wife)',
          'Sit at the kitchen table - most natural and comfortable place to cover material',
          'FOLLOW THE PRESENTATION SCRIPT word-for-word. It works!',
          'Be very calm, confident, direct, and clear - speak slowly and clearly',
          'Mirror your customer - if they\'re relaxed, be casual; if enthusiastic, reflect more energy',
          'Don\'t pull out agreement paperwork until the moment to go over details',
          'Ask "Does that make sense?" and "Does that sound fair?" to confirm understanding',
          'Hand over the pen and BE QUIET after you ask them to sign - lean back and remain neutral',
          'Expect them to sign - wouldn\'t someone? They\'ve got nothing to lose and everything to gain',
        ],
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
          { value: 'b', label: 'Xactimate, Diagram/EagleView, agreement copy, and business cards' },
          { value: 'c', label: 'Only photos of damage' },
          { value: 'd', label: 'The homeowner\'s insurance policy' },
        ],
      },
      {
        id: 'q7',
        text: 'How many hail hits should you circle on the roof before the adjuster arrives?',
        options: [
          { value: 'a', label: 'All of them' },
          { value: 'b', label: '5-7 hits (not the most obvious ones)' },
          { value: 'c', label: 'None - let the adjuster find them' },
          { value: 'd', label: '1-2 hits only' },
        ],
      },
      {
        id: 'q8',
        text: 'After the homeowner signs, what directions should you write on their copy?',
        options: [
          { value: 'a', label: 'Just your phone number' },
          { value: 'b', label: 'Call insurance 1-800#, write claim #, get adjuster name/phone, get meeting date/time, call you' },
          { value: 'c', label: 'The warranty information' },
          { value: 'd', label: 'Nothing - the agreement speaks for itself' },
        ],
      },
      {
        id: 'q9',
        text: 'Where is the best place to sit when presenting to homeowners?',
        options: [
          { value: 'a', label: 'On the front porch' },
          { value: 'b', label: 'At the kitchen table' },
          { value: 'c', label: 'In the living room on the couch' },
          { value: 'd', label: 'Standing in the driveway' },
        ],
      },
      {
        id: 'q10',
        text: 'When talking to the adjuster about marginal damage, what approach should you use?',
        options: [
          { value: 'a', label: 'Demand they include it in the claim' },
          { value: 'b', label: 'Ask questions like "I couldn\'t say for certain it WAS hail damage... what do you think?"' },
          { value: 'c', label: 'Ignore marginal damage completely' },
          { value: 'd', label: 'Tell the homeowner to argue for it' },
        ],
      },
    ],
  },
];
