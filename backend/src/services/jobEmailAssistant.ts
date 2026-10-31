import type { CareerProfile, JobListing, EmployerResponseRecord } from '../types/domain.js';

export interface EmployerAnalysisResult {
  category: EmployerResponseRecord['category'];
  categoryLabel: string;
  sentiment: 'positive' | 'neutral' | 'inquiry' | 'rejection';
  keyPoints: string[];
  suggestedReply: string;
  actionItems: string[];
}

export class JobEmailAssistant {
  /**
   * Analyzes an incoming employer email and crafts a tailored, professional response.
   */
  public analyzeAndGenerateReply(
    employerMessage: string,
    profile: CareerProfile | null,
    job: JobListing | null
  ): EmployerAnalysisResult {
    const text = employerMessage.toLowerCase();
    const candidateName = profile?.fullName || 'Candidate';
    const candidatePhone = profile?.phone || '';
    const candidateEmail = profile?.email || '';
    const portfolioLink = profile?.portfolioLinks?.[0] || profile?.socialAccounts?.find((s) => s.platform === 'LinkedIn' || s.platform === 'Portfolio')?.url || '';
    const jobTitle = job?.title || 'the applied position';
    const companyName = job?.company || 'your team';

    // 1. Detect Category
    let category: EmployerResponseRecord['category'] = 'general';
    let categoryLabel = 'General Inquiries';
    let sentiment: 'positive' | 'neutral' | 'inquiry' | 'rejection' = 'neutral';
    const keyPoints: string[] = [];
    const actionItems: string[] = [];

    if (/reject|unfortunately|not moving forward|other candidates|not be progressing|regret to inform/i.test(text)) {
      category = 'rejection';
      categoryLabel = 'Rejection Notice';
      sentiment = 'rejection';
      keyPoints.push('Employer decided not to advance with the application at this time.');
      actionItems.push('Acknowledge gracefully and request to stay connected for future openings.');
    } else if (/interview|chat|call|meeting|schedule|availability for a (call|discussion)|zoom|teams|google meet/i.test(text)) {
      category = 'interview_invite';
      categoryLabel = 'Interview / Discussion Invitation';
      sentiment = 'positive';
      keyPoints.push('Employer has invited you for an introductory or technical interview.');
      actionItems.push('Provide specific available time slots and confirm preferred meeting platform.');
    } else if (/salary|compensation|rate|expectation|budget/i.test(text)) {
      category = 'salary_inquiry';
      categoryLabel = 'Salary & Compensation Question';
      sentiment = 'inquiry';
      keyPoints.push('Employer is asking for compensation expectations or hourly/annual rates.');
      actionItems.push('Confirm expected range aligned with role scope and market standard.');
    } else if (/availability|notice period|start date|when can you start|earliest start/i.test(text)) {
      category = 'availability_inquiry';
      categoryLabel = 'Availability & Start Date';
      sentiment = 'inquiry';
      keyPoints.push('Employer is inquiring about your notice period or earliest possible start date.');
      actionItems.push('State availability clearly (immediate / standard notice).');
    } else if (/portfolio|github|code sample|work samples|live project/i.test(text)) {
      category = 'portfolio_request';
      categoryLabel = 'Portfolio & Work Samples Request';
      sentiment = 'inquiry';
      keyPoints.push('Employer requested links to live projects, GitHub repository, or design portfolio.');
      actionItems.push('Share verified GitHub / Portfolio links and offer a walkthrough.');
    } else if (/document|transcripts|certificate|id proof|visa copy|reference/i.test(text)) {
      category = 'document_request';
      categoryLabel = 'Additional Documents Request';
      sentiment = 'inquiry';
      keyPoints.push('Employer requested supporting identification, educational, or professional documents.');
      actionItems.push('Attach or confirm readiness to provide verified documents.');
    } else if (/technical|assessment|test|coding challenge|task/i.test(text)) {
      category = 'technical_questions';
      categoryLabel = 'Technical Assessment / Questionnaire';
      sentiment = 'inquiry';
      keyPoints.push('Employer shared a technical task or questionnaire.');
      actionItems.push('Acknowledge receipt and specify estimated completion timeline.');
    } else if (/more information|tell us more|clarify|question/i.test(text)) {
      category = 'info_request';
      categoryLabel = 'Request for Clarification / Information';
      sentiment = 'neutral';
      keyPoints.push('Employer requested additional details regarding your background.');
      actionItems.push('Provide clear, concise answers to the specific inquiries.');
    }

    // 2. Draft Tailored Reply Based on Real Profile
    let replyBody = '';

    switch (category) {
      case 'interview_invite': {
        replyBody = `Dear Hiring Team,

Thank you very much for reaching out and for considering my application for the ${jobTitle} role at ${companyName}. I would be delighted to speak with you!

I am available for an introductory call during the following windows (please feel free to pick what suits your calendar best):
• Tomorrow between 10:00 AM – 2:00 PM (EST / UTC)
• Any weekday afternoon between 2:00 PM – 6:00 PM

Please let me know if a specific platform (Google Meet, Zoom, or Teams) is preferred, or send through a calendar invite. I look forward to learning more about the role and how my technical background can support your goals.

Best regards,
${candidateName}
${candidateEmail}${candidatePhone ? ` | ${candidatePhone}` : ''}
${portfolioLink ? `Portfolio / LinkedIn: ${portfolioLink}` : ''}`.trim();
        break;
      }

      case 'salary_inquiry': {
        const desiredSalary = profile?.minSalary || 'market competitive based on role requirements and responsibilities';
        replyBody = `Dear Hiring Team,

Thank you for following up regarding compensation for the ${jobTitle} position.

My target expectation is ${desiredSalary}, though I am open to discussing a mutually beneficial package considering the total compensation structure, benefits, and growth opportunities at ${companyName}.

I remain very enthusiastic about the impact I can deliver for your team and welcome the opportunity to discuss this further.

Warm regards,
${candidateName}
${candidateEmail}`;
        break;
      }

      case 'availability_inquiry': {
        replyBody = `Dear Hiring Team,

Thank you for following up. Regarding my availability for the ${jobTitle} role at ${companyName}:

I am available to start within a standard 2-week notice period (or immediately for remote contract engagements). I can accommodate the necessary onboarding and transition requirements smoothly.

Please let me know if you need any additional logistical details.

Best regards,
${candidateName}
${candidateEmail}`;
        break;
      }

      case 'portfolio_request': {
        replyBody = `Dear Hiring Team,

Thank you for following up on my application for the ${jobTitle} role.

You can explore my verified portfolio and technical repositories here:
${portfolioLink ? `• Primary Portfolio / Profile: ${portfolioLink}` : '• Projects & Case Studies: Available upon request'}
${profile?.socialAccounts?.find((s) => s.platform === 'GitHub')?.url ? `• GitHub Codebase: ${profile.socialAccounts.find((s) => s.platform === 'GitHub')!.url}` : ''}

I would be happy to walk you through specific architectural decisions and production implementations at your convenience.

Best regards,
${candidateName}
${candidateEmail}`;
        break;
      }

      case 'rejection': {
        replyBody = `Dear Hiring Team,

Thank you for letting me know about your decision regarding the ${jobTitle} position at ${companyName}.

While I am disappointed not to have the opportunity to work together at this stage, I genuinely enjoyed learning about your work and vision. I would appreciate the opportunity to stay in touch for future openings that match my background.

I wish you and the team continued success.

Warm regards,
${candidateName}
${candidateEmail}`;
        break;
      }

      case 'technical_questions': {
        replyBody = `Dear Hiring Team,

Thank you for sharing the technical details and assessment for the ${jobTitle} position.

I have received the materials and will review them thoroughly. I anticipate completing and returning the submission within the next 48 hours. Should any clarifying questions arise, I will reach out promptly.

Thank you again for the opportunity to showcase my skills.

Best regards,
${candidateName}
${candidateEmail}`;
        break;
      }

      case 'document_request': {
        replyBody = `Dear Hiring Team,

Thank you for following up regarding my application for the ${jobTitle} role.

I am preparing the requested documentation and will forward the verified files shortly. Please let me know if there are any specific format or submission guidelines you would like me to adhere to.

Best regards,
${candidateName}
${candidateEmail}`;
        break;
      }

      default: {
        replyBody = `Dear Hiring Team,

Thank you for contacting me regarding my application for the ${jobTitle} role at ${companyName}.

I appreciate your message and would be happy to provide any further clarification or details you require. Please let me know the best next steps.

Best regards,
${candidateName}
${candidateEmail}${candidatePhone ? ` | ${candidatePhone}` : ''}`;
        break;
      }
    }

    return {
      category,
      categoryLabel,
      sentiment,
      keyPoints,
      suggestedReply: replyBody,
      actionItems,
    };
  }
}

export const jobEmailAssistant = new JobEmailAssistant();
