process.stderr.write("Blocked by a project hook: terminal commands are not allowed in this project. The user runs npm.cmd test and pastes the output. Stop and ask the user. Do not try another way to run commands.");
process.exit(2);
