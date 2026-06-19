# Changelog

All notable changes to Evolution Manager v2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open source preparation with comprehensive documentation
- GitHub issue templates and PR templates
- Security policy and vulnerability reporting process
- Docker Compose setup for easy deployment
- Code quality tools (Prettier, ESLint configurations)

### Changed
- Updated package.json with proper metadata and repository information
- Improved project structure for open source development

## [2.0.0] - develop

### Added
- Modern React + TypeScript + Vite architecture
- Comprehensive dashboard for Evolution API management
- Multi-language support (PT-BR, EN-US, ES-ES, FR-FR)
- Dark/Light theme support with system preference detection
- Real-time WebSocket integration for live updates
- Responsive design for desktop and mobile devices

#### Chat Management
- WhatsApp chat interface with message history
- Media file handling and preview
- Contact management and search
- Message status tracking

#### Chatbot Integrations
- **OpenAI** - GPT-powered conversations with customizable settings
- **Dify** - AI workflow automation platform integration
- **Typebot** - Visual flow builder for conversational experiences
- **Chatwoot** - Customer support platform integration
- **Flowise** - Low-code AI application builder
- **N8N** - Workflow automation platform
- **Evolution Bot** - Built-in chatbot functionality

#### Event Integrations
- **Webhook** - HTTP event delivery with retry logic
- **WebSocket** - Real-time event streaming
- **RabbitMQ** - Message queue integration
- **SQS** - Amazon Simple Queue Service integration
- **Apache Kafka** - Event streaming platform support

#### Instance Management
- Multi-instance dashboard with status monitoring
- Instance creation and configuration
- QR code display for WhatsApp connection
- Connection status and health monitoring
- Bulk operations for multiple instances

#### User Interface
- Modern UI components built with Radix UI
- Tailwind CSS for consistent styling
- Accessible design following WCAG guidelines
- Keyboard navigation support
- Loading states and error handling

#### Configuration Management
- Instance settings and behavior configuration
- Proxy configuration for network routing
- Authentication and security settings
- Integration-specific configurations

### Technical Features
- TypeScript for type safety and better developer experience
- React Query for efficient data fetching and caching
- React Hook Form with Zod validation
- Socket.io client for real-time communication
- Recharts for data visualization
- Internationalization with react-i18next

### Security
- Input validation and sanitization
- CSRF protection
- Secure authentication handling
- Content Security Policy support

### Performance
- Code splitting and lazy loading
- Optimized bundle size
- Efficient re-rendering with React optimization
- Caching strategies for API responses

## [1.x.x] - Legacy Versions

Previous versions of Evolution Manager (v1.x.x) are now considered legacy.
For migration guides and legacy documentation, please refer to the
[Migration Guide](docs/MIGRATION.md).

---

## Release Notes Format

### Types of Changes
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

### Contributing to Changelog
When contributing to the project, please update the `[Unreleased]` section
with your changes. The maintainers will move entries to the appropriate
version section during release preparation.

---

**Evolution Manager v2** - Built with ❤️ by the Evolution API Team
