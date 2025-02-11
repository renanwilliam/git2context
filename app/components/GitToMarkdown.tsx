'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Github } from 'lucide-react';

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.href : '';
const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo&state=${Math.random().toString(36).substring(7)}`;

const GitToMarkdown = () => {
    const [repoUrl, setRepoUrl] = useState('');
    const [branch, setBranch] = useState('main');
    const [accessToken, setAccessToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [needsAuth, setNeedsAuth] = useState(false);

    useEffect(() => {
        console.log('Checking URL parameters...');
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        console.log('Code:', code);

        if (code) {
            console.log('Authorization code found!');
            fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Token response:', data);
                    if (data.access_token) {
                        setAccessToken(data.access_token);
                        setNeedsAuth(false);

                        const savedUrl = localStorage.getItem('lastRepoUrl');
                        const savedBranch = localStorage.getItem('lastBranch');
                        console.log('Saved data:', { savedUrl, savedBranch });

                        if (savedUrl) {
                            setRepoUrl(savedUrl);
                            setBranch(savedBranch || 'main');
                            console.log('Starting automatic processing...');
                            handleSubmit(new Event('submit'));
                        }
                    }
                })
                .catch(error => {
                    console.error('Error exchanging code for token:', error);
                    setError('Authentication failed. Please try again.');
                });

            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // List of extensions we want to process
    const validExtensions = [
        // Web
        'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'json',
        // Backend
        'py', 'pyx', 'pyi', 'rb', 'php', 'java', 'kt', 'scala', 'go', 'rs', 'cs', 'swift',
        // Systems
        'c', 'cpp', 'h', 'hpp',
        // Shell/Scripts
        'sh', 'bash', 'zsh', 'fish', 'ps1',
        // Config
        'toml', 'yaml', 'yml', 'ini', 'env', 'conf',
        // Documentation
        'md', 'rst', 'txt', 'tex',
        // Data
        'sql', 'graphql', 'prisma'
    ];

    const getLanguageFromExtension = (filepath) => {
        const extension = filepath.split('.').pop().toLowerCase();

        const languageMap = {
            // Web & JavaScript ecosystem
            'html': 'html',
            'css': 'css',
            'js': 'javascript',
            'jsx': 'jsx',
            'ts': 'typescript',
            'tsx': 'tsx',
            'mjs': 'javascript',
            'json': 'json',

            // Python ecosystem
            'py': 'python',
            'pyx': 'python',
            'pyi': 'python',

            // Ruby
            'rb': 'ruby',

            // PHP
            'php': 'php',

            // JVM ecosystem
            'java': 'java',
            'kt': 'kotlin',
            'scala': 'scala',

            // Systems programming
            'c': 'c',
            'cpp': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'rs': 'rust',
            'go': 'go',

            // C#/.NET
            'cs': 'csharp',

            // Swift
            'swift': 'swift',

            // Shell scripting
            'sh': 'bash',
            'bash': 'bash',
            'zsh': 'bash',
            'fish': 'fish',
            'ps1': 'powershell',

            // Configuration
            'toml': 'toml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'ini': 'ini',
            'env': 'plaintext',
            'conf': 'plaintext',

            // Documentation
            'md': 'markdown',
            'rst': 'rst',
            'txt': 'plaintext',
            'tex': 'tex',

            // Data
            'sql': 'sql',
            'graphql': 'graphql',
            'prisma': 'prisma'
        };

        return languageMap[extension] || 'plaintext';
    };

    const processFile = async (file, content) => {
        const language = getLanguageFromExtension(file.path);
        return `Path: ${file.path}\n\n\`\`\`${language}\n${content}\n\`\`\`\n\n-----------\n\n`;
    };

    const fetchWithAuth = async (url, isFirstTry = true) => {
        console.log('Making request to:', url);
        console.log('With token:', accessToken ? 'Yes' : 'No');

        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, { headers });
        console.log('Response status:', response.status);

        if ([401, 403, 404].includes(response.status)) {
            if (isFirstTry && !accessToken) {
                setNeedsAuth(true);
                throw new Error('This might be a private repository or your are rate limited. Please login with GitHub to access it.');
            }
            if (response.status === 401) {
                setAccessToken('');
                throw new Error('Session expired. Please login again.');
            }
            if (response.status === 404) {
                throw new Error('Repository not found. Please check the URL and try again.');
            }
        }
        if (!response.ok) {
            throw new Error(`GitHub Error: ${response.statusText}`);
        }

        return response;
    };

    const handleLogin = () => {
        console.log('Saving data before login...');
        localStorage.setItem('lastRepoUrl', repoUrl);
        localStorage.setItem('lastBranch', branch);
        console.log('Redirecting to GitHub...');
        window.location.href = GITHUB_AUTH_URL;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Starting submit...');
        console.log('Current state:', { repoUrl, branch, accessToken });

        setIsLoading(true);
        setError('');
        setNeedsAuth(false);

        try {
            const urlParts = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(\.git)?$/);
            if (!urlParts) {
                throw new Error('Invalid GitHub repository URL');
            }

            const [, owner, repo] = urlParts;
            const cleanRepo = repo.replace('.git', '');
            const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/${branch}?recursive=1`;

            console.log('Fetching repository tree...');
            const treeResponse = await fetchWithAuth(apiUrl);
            const treeData = await treeResponse.json();

            const files = treeData.tree.filter(file =>
                file.type === 'blob' &&
                validExtensions.includes(file.path.split('.').pop().toLowerCase())
            );

            console.log('Files found:', files.length);

            let markdownContent = '';
            for (const file of files) {
                console.log('Processing file:', file.path);
                const contentResponse = await fetchWithAuth(
                    `https://api.github.com/repos/${owner}/${cleanRepo}/contents/${file.path}?ref=${branch}`,
                    false
                );
                const contentData = await contentResponse.json();

                if (contentResponse.ok) {
                    const content = atob(contentData.content);
                    markdownContent += await processFile(file, content);
                }
            }

            if (markdownContent === '') {
                throw new Error('No compatible files found in the repository.');
            }

            console.log('Generating download file...');
            const blob = new Blob([markdownContent], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${cleanRepo}_${branch}_context.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error('Error during processing:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Git to Markdown Converter</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Repository URL</label>
                        <Input
                            type="text"
                            placeholder="https://github.com/user/repo"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Branch</label>
                        <Input
                            type="text"
                            placeholder="main"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            required
                        />
                    </div>
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {needsAuth && (
                        <Button
                            type="button"
                            onClick={handleLogin}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            <Github className="h-5 w-5" />
                            Login with GitHub
                        </Button>
                    )}
                </form>
            </CardContent>
            <CardFooter>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing
                        </>
                    ) : (
                        'Generate Markdown'
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
};

export default GitToMarkdown;