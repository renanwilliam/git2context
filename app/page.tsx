import GitToMarkdown from './components/GitToMarkdown';

export default function Home() {
    return (
        <main className="min-h-screen bg-white p-4 md:p-24">
            <div className="max-w-xl mx-auto">
                <GitToMarkdown />
            </div>
        </main>
    );
}